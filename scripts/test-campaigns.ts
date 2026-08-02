// End-to-end tests for the campaign, forms, brands, commerce and smart-send
// expansion. Runs against the dev database, creates its own workspace, and
// cleans up after itself.
//
//   npx tsx scripts/test-campaigns.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { db } from "../lib/server/db";
import { blankTemplate, parseBlocks, validateBlocks, renderEmail, type EmailBlock, type RenderContext } from "../lib/server/email-blocks";
import { renderPreview, renderForRecipient, resolveFeeds, signEmailAction, verifyEmailAction } from "../lib/server/email-render";
import { issueCoupon, recordRedemption } from "../lib/server/promotions";
import { evaluateCondition, applyActions } from "../lib/server/conditions";
import { evaluateSegmentMembers } from "../lib/server/segments";
import { startSmartSend, runCampaignBatch, pauseSmartSend, resumeSmartSend, cancelSmartSend, smartSendProgress } from "../lib/server/smart-send";
import { adapterFor } from "../lib/server/commerce/adapter";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(`${name}${detail ? ` · ${detail}` : ""}`); console.log(`  ✗ ${name}${detail ? ` · ${detail}` : ""}`); }
}

async function main() {
  // ── Fixture workspace ──────────────────────────────────────────────────────
  const ws = await db.workspace.create({ data: { name: "Campaign test workspace" } });
  const store = await db.store.create({
    data: { workspaceId: ws.id, name: "Test Store", url: "test.example.com", apiKey: `test_${ws.id}`, status: "connected", platform: "woocommerce" },
  });
  const contact = await db.contact.create({
    data: { workspaceId: ws.id, email: "buyer@test.local", firstName: "Test", lastName: "Buyer" },
  });
  await db.consentRecord.create({
    data: { contactId: contact.id, channel: "email", status: "granted", lawfulBasis: "test", actor: "test" },
  });
  const product = await db.product.create({
    data: { storeId: store.id, externalId: "SKU1", title: "Test Serum", price: 29, salePrice: 24, imageUrl: "https://img.test/1.jpg", url: "https://test.example.com/p/1", categories: JSON.stringify(["Recovery"]) },
  });

  try {
    // ── Blocks: render, validate, personalise ────────────────────────────────
    console.log("\nBlocks and rendering");
    const blank = blankTemplate();
    check("Blank template carries a footer", blank.some((b) => b.type === "footer"));
    check("Validation rejects a missing footer", validateBlocks(blank.filter((b) => b.type !== "footer")).some((i) => i.level === "error"));
    check("Validation flags a missing image alt", validateBlocks([{ id: "x", type: "image", url: "https://a/b.png", alt: "" }, ...blank]).some((i) => i.message.includes("alt")));
    check("Validation flags a broken button link", validateBlocks([{ id: "x", type: "button", label: "Go", href: "not-a-url" }, ...blank]).some((i) => i.level === "error" && i.message.includes("Go")));

    const preview = await renderPreview({ workspaceId: ws.id, blocks: blank });
    check("Preview renders full HTML with unsubscribe", preview.html.includes("<!DOCTYPE html") && preview.html.includes("Unsubscribe"));
    check("Preview personalises with sample data", preview.html.includes("Hello Alex"));
    check("Plain-text fallback is produced", preview.textBody.length > 20 && preview.textBody.includes("Unsubscribe"));

    // Feeds resolve to concrete grids.
    const feedBlocks: EmailBlock[] = [{ id: "f", type: "product_feed", rule: "newest", limit: 2 }, ...blank];
    const resolved = await resolveFeeds(feedBlocks, ws.id, null);
    check("Dynamic feed resolves to a fixed product grid", resolved.some((b) => b.type === "product_grid"));

    // ── Journey C: template → campaign → send ────────────────────────────────
    console.log("\nJourney C: campaign with template, coupon, product");
    const template = await db.emailTemplate.create({
      data: { workspaceId: ws.id, name: "Test template", category: "discount", content: JSON.stringify(blank), updatedBy: "test" },
    });
    const brand = await db.brand.create({
      data: { workspaceId: ws.id, name: "Test Brand", primaryColor: "#0e7490", senderName: "Test Brand", senderEmail: "hello@test.example.com", storeId: store.id },
    });
    const promo = await db.promotion.create({
      data: { workspaceId: ws.id, storeId: store.id, name: "Welcome 10", mode: "unique", prefix: "TST", kind: "percent", amount: 10, expiryDays: 14 },
    });

    const campaignBlocks: EmailBlock[] = [
      { id: "b1", type: "heading", text: "Hello {{first_name}}", level: 1 },
      { id: "b2", type: "product", productId: product.id },
      { id: "b3", type: "coupon", promotionId: promo.id, shopUrl: "https://test.example.com" },
      { id: "b4", type: "footer" },
    ];
    const campaign = await db.campaign.create({
      data: { workspaceId: ws.id, name: "Test blast", subject: "Hi {{first_name}}", content: JSON.stringify(campaignBlocks), templateId: template.id, brandId: brand.id, audienceType: null },
    });

    // Preview must not mint a coupon.
    await renderPreview({ workspaceId: ws.id, blocks: campaignBlocks, brandId: brand.id });
    check("Preview never mints coupon codes", (await db.couponCode.count({ where: { promotionId: promo.id } })) === 0);

    // Per-recipient render mints exactly one, idempotently.
    const send = await db.campaignSend.create({ data: { campaignId: campaign.id, contactId: contact.id, status: "queued" } });
    const r1 = await renderForRecipient({ workspaceId: ws.id, campaignId: campaign.id, sendId: send.id, contact: { id: contact.id, email: contact.email! }, blocks: campaignBlocks, brandId: brand.id });
    const r2 = await renderForRecipient({ workspaceId: ws.id, campaignId: campaign.id, sendId: send.id, contact: { id: contact.id, email: contact.email! }, blocks: campaignBlocks, brandId: brand.id });
    const codes = await db.couponCode.findMany({ where: { promotionId: promo.id } });
    check("Send render issues exactly one coupon per contact", codes.length === 1, `${codes.length}`);
    check("Re-render returns the same code (idempotent)", r1.html.includes(codes[0].code) && r2.html.includes(codes[0].code));
    check("Brand colours applied to send render", r1.html.includes("#0e7490"));
    check("Product resolved into the email", r1.html.includes("Test Serum"));
    check("Per-send tracking pixel present", r1.html.includes(`/api/t/open/${send.id}`));
    check("Signed unsubscribe link present", r1.html.includes(`/api/t/unsub/${send.id}?sig=`));
    await db.campaignSend.delete({ where: { id: send.id } });

    // Signature scheme.
    console.log("\nSigned email actions");
    const sig = signEmailAction("unsub.abc");
    check("Valid signature verifies", verifyEmailAction("unsub.abc", sig));
    check("Tampered payload fails", !verifyEmailAction("unsub.xyz", sig));

    // ── Journey D: conditions, tags, properties, audiences ──────────────────
    console.log("\nJourney D: conditions → tags → audiences");
    const hit = await evaluateCondition({ field: "interest", op: "equals", value: "Recovery" }, { interest: "Recovery" }, null);
    const miss = await evaluateCondition({ field: "interest", op: "equals", value: "Recovery" }, { interest: "Skin" }, null);
    check("Condition equals matches and misses correctly", hit && !miss);

    const applied = await applyActions(ws.id, contact.id, [
      { action: "add_tag", tag: "interest:recovery" },
      { action: "set_property", key: "primary_interest", value: "recovery" },
    ], "test");
    check("Actions apply tag and property", applied.tagsAdded.includes("interest:recovery") && applied.propertiesSet.primary_interest === "recovery");

    const applied2 = await applyActions(ws.id, contact.id, [{ action: "add_tag", tag: "interest:recovery" }], "test");
    const tagLinks = await db.contactTag.count({ where: { contactId: contact.id } });
    check("Re-applying a tag does not duplicate", applied2.tagsAdded.length === 1 && tagLinks === 1);

    const segment = await db.segment.create({
      data: {
        workspaceId: ws.id, name: "Recovery interest", match: "all",
        rules: { create: [{ field: "Property", operator: "is", value: "primary_interest=recovery" }] },
      },
    });
    const segRules = await db.segmentRule.findMany({ where: { segmentId: segment.id } });
    const members = await evaluateSegmentMembers(ws.id, "all", segRules);
    check("Dynamic audience picks up the property", members.includes(contact.id));

    await db.contact.update({ where: { id: contact.id }, data: { customFields: JSON.stringify({ primary_interest: "skin" }) } });
    const members2 = await evaluateSegmentMembers(ws.id, "all", segRules);
    check("Membership updates when the property changes", !members2.includes(contact.id));
    await db.contact.update({ where: { id: contact.id }, data: { customFields: JSON.stringify({ primary_interest: "recovery" }) } });

    // ── Coupons: redemption ──────────────────────────────────────────────────
    console.log("\nCoupon redemption");
    const red1 = await recordRedemption(codes[0].code, "ORDER-1", contact.email);
    const red2 = await recordRedemption(codes[0].code, "ORDER-2", contact.email);
    check("Redemption recorded once, idempotently", red1?.redeemedAt !== null && red2?.orderRef === "ORDER-1");

    const shared = await db.promotion.create({
      data: { workspaceId: ws.id, name: "Shared", mode: "shared", sharedCode: "WELCOME10", kind: "percent", amount: 10 },
    });
    const sIssue = await issueCoupon({ promotionId: shared.id, workspaceId: ws.id, contactId: contact.id, email: contact.email, source: "test" });
    check("Shared promotion returns the shared code", sIssue?.code === "WELCOME10");

    // ── Adapters ─────────────────────────────────────────────────────────────
    console.log("\nCommerce adapters");
    const woo = adapterFor("woocommerce");
    const shopify = adapterFor("shopify");
    check("WooCommerce adapter is operational with coupon capabilities", woo?.status === "operational" && (woo?.capabilities.includes("coupon_push") ?? false));
    check("Shopify adapter is honestly coming_soon with no capabilities", shopify?.status === "coming_soon" && shopify?.capabilities.length === 0);
    const health = await woo!.health(store as never);
    check("Woo health reports the connected plugin channel", health.connected === true);

    // ── Smart sending ────────────────────────────────────────────────────────
    console.log("\nSmart sending");
    // A second consented contact so batching is visible.
    const c2 = await db.contact.create({ data: { workspaceId: ws.id, email: "second@test.local" } });
    await db.consentRecord.create({ data: { contactId: c2.id, channel: "email", status: "granted", lawfulBasis: "test", actor: "test" } });

    const gradual = await db.campaign.create({
      data: { workspaceId: ws.id, name: "Gradual", subject: "Gradual", content: JSON.stringify(blank), audienceType: null },
    });
    const started = await startSmartSend(gradual.id, "test", { mode: "gradual", durationMins: 60, batchSize: 1 });
    check("Gradual send enqueues the audience", started.ok && (started as { queued: number }).queued === 2, JSON.stringify(started));

    const again = await startSmartSend(gradual.id, "test", { mode: "gradual", durationMins: 60, batchSize: 1 });
    check("Restart cannot double-enqueue (unique guard)", !again.ok);

    // First batch sends exactly one (batch size 1).
    let r = await runCampaignBatch(gradual.id);
    let prog = await smartSendProgress(gradual.id);
    check("First batch delivers exactly the batch size", r === "continue" && prog.sent === 1 && prog.queued === 1, JSON.stringify(prog));

    // Cadence: immediately re-running is skipped until due.
    r = await runCampaignBatch(gradual.id);
    check("Batches respect the cadence (not due = skipped)", r === "skipped");

    // Pause blocks delivery; resume restores it.
    await pauseSmartSend(gradual.id, "test");
    r = await runCampaignBatch(gradual.id, new Date(Date.now() + 3_600_000));
    check("Paused campaign delivers nothing", r === "skipped");
    await resumeSmartSend(gradual.id, "test");

    // Unsubscribe between batches: the pre-batch recheck suppresses.
    await db.suppressionRecord.create({ data: { workspaceId: ws.id, email: "second@test.local", reason: "unsubscribed" } });
    r = await runCampaignBatch(gradual.id, new Date(Date.now() + 3_700_000));
    prog = await smartSendProgress(gradual.id);
    check("Pre-batch recheck suppresses the unsubscribed recipient", prog.suppressed === 1 && prog.queued === 0, JSON.stringify(prog));

    r = await runCampaignBatch(gradual.id, new Date(Date.now() + 7_200_000));
    const finished = await db.campaign.findUnique({ where: { id: gradual.id } });
    check("Drained campaign completes", finished?.sendState === "complete" && finished.status === "sent");

    // Cancel path.
    const c3 = await db.contact.create({ data: { workspaceId: ws.id, email: "third@test.local" } });
    await db.consentRecord.create({ data: { contactId: c3.id, channel: "email", status: "granted", lawfulBasis: "test", actor: "test" } });
    const toCancel = await db.campaign.create({
      data: { workspaceId: ws.id, name: "Cancel me", subject: "x", content: JSON.stringify(blank), audienceType: null },
    });
    await startSmartSend(toCancel.id, "test", { mode: "gradual", durationMins: 1440, batchSize: 1 });
    const cancelledCount = await cancelSmartSend(toCancel.id, "test");
    check("Cancel marks all unsent recipients cancelled", cancelledCount >= 1);

    // ── Workspace isolation ──────────────────────────────────────────────────
    console.log("\nIsolation");
    const otherTemplates = await db.emailTemplate.findMany({ where: { workspaceId: { not: ws.id }, name: "Test template" } });
    check("Templates do not leak across workspaces", otherTemplates.length === 0);
  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────────
    const campaigns = await db.campaign.findMany({ where: { workspaceId: ws.id }, select: { id: true } });
    await db.campaignSend.deleteMany({ where: { campaignId: { in: campaigns.map((c) => c.id) } } });
    await db.campaign.deleteMany({ where: { workspaceId: ws.id } });
    await db.emailTemplate.deleteMany({ where: { workspaceId: ws.id } });
    await db.globalElementVersion.deleteMany({ where: { element: { workspaceId: ws.id } } });
    await db.globalElement.deleteMany({ where: { workspaceId: ws.id } });
    await db.couponCode.deleteMany({ where: { promotion: { workspaceId: ws.id } } });
    await db.promotion.deleteMany({ where: { workspaceId: ws.id } });
    await db.brand.deleteMany({ where: { workspaceId: ws.id } });
    await db.segmentRule.deleteMany({ where: { segment: { workspaceId: ws.id } } });
    await db.segment.deleteMany({ where: { workspaceId: ws.id } });
    await db.product.deleteMany({ where: { storeId: store.id } });
    await db.suppressionRecord.deleteMany({ where: { workspaceId: ws.id } });
    const contacts = await db.contact.findMany({ where: { workspaceId: ws.id }, select: { id: true } });
    await db.contactTag.deleteMany({ where: { contactId: { in: contacts.map((c) => c.id) } } });
    await db.tag.deleteMany({ where: { workspaceId: ws.id } });
    await db.consentRecord.deleteMany({ where: { contactId: { in: contacts.map((c) => c.id) } } });
    await db.contactSource.deleteMany({ where: { contactId: { in: contacts.map((c) => c.id) } } });
    await db.timelineItem.deleteMany({ where: { contactId: { in: contacts.map((c) => c.id) } } });
    await db.event.deleteMany({ where: { workspaceId: ws.id } });
    await db.contact.deleteMany({ where: { workspaceId: ws.id } });
    await db.store.delete({ where: { id: store.id } });
    await db.usageCounter.deleteMany({ where: { workspaceId: ws.id } });
    await db.auditLog.deleteMany({ where: { workspaceId: ws.id } });
    await db.workspace.delete({ where: { id: ws.id } });
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) failures.forEach((f) => console.log(`  · ${f}`));
  await db.$disconnect();
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
