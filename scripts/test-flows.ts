// End-to-end flow tests against the real services and database.
// Run: npm run test:flows  (uses the current DATABASE_URL; safe to run on the
// seeded dev database — it creates its own throwaway records).
import { db } from "../lib/server/db";
import { createBatchFromCsv, reviewBatch, confirmBatch, detectMapping } from "../lib/server/imports";
import { eventIngestionService } from "../lib/server/events";
import { recomputeLeadScore } from "../lib/server/scoring";
import { evaluateSegment } from "../lib/server/segments";
import { createIntakeFromText, approveRecord } from "../lib/server/extract";
import { touchCart, sweepAbandoned } from "../lib/server/carts";
import { sendCampaign } from "../lib/server/sending";
import { checkRateLimit } from "../lib/server/auth";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const STAMP = `t${Math.abs(Date.now() % 1_000_000)}`;

async function main() {
  const ws = await db.workspace.findFirstOrThrow();

  console.log("Field mapping detection");
  const mapping = detectMapping(["email_address", "fname", "surname", "mobile", "gdpr_optin", "weird_column"]);
  check("detects email/first/last/phone/consent", mapping["email_address"] === "email" && mapping["fname"] === "firstName" && mapping["surname"] === "lastName" && mapping["mobile"] === "phone" && mapping["gdpr_optin"] === "consent");
  check("unknown columns become custom fields", mapping["weird_column"] === "custom");

  console.log("Import pipeline");
  const csv = [
    "email,first_name,gdpr_optin",
    `alice.${STAMP}@example.com,Alice,TRUE`,
    `alice.${STAMP}@example.com,Alice,TRUE`, // in-file duplicate
    `bob.${STAMP}@tempmail.io,Bob,TRUE`, // disposable
    "not-an-email,Nope,TRUE", // invalid
    `carol.${STAMP}@example.com,Carol,`, // no consent
  ].join("\n");

  const batch = await createBatchFromCsv({
    workspaceId: ws.id, name: `Test batch ${STAMP}`, source: "test", sourceType: "import",
    uploadedBy: "test-script", csv,
  });
  check("batch created with 5 rows", batch.totalRows === 5);

  const review = await reviewBatch(batch.batchId, batch.mapping);
  check("1 ready row", review.counts.ready === 1, JSON.stringify(review.counts));
  check("1 in-file duplicate", review.counts.duplicate === 1);
  check("1 blocked (disposable)", review.counts.blocked === 1);
  check("1 invalid email", review.counts.invalid === 1);
  check("1 held for consent review", review.counts.needsReview === 1);

  const confirm = await confirmBatch({
    batchId: batch.batchId, duplicateStrategy: "merge_newest",
    tags: [`test-${STAMP}`], lawfulBasis: "Test", createSegment: true, actor: "test-script",
  });
  check("2 contacts imported (alice + carol)", confirm.imported === 2, JSON.stringify(confirm));
  check("1 merged (in-file duplicate)", confirm.merged === 1);
  const taggedAlice = await db.contact.findUnique({
    where: { workspaceId_email: { workspaceId: ws.id, email: `alice.${STAMP}@example.com` } },
    include: { tags: { include: { tag: true } } },
  });
  check("import tag attached to imported contact", taggedAlice?.tags.some((ct) => ct.tag.name === `test-${STAMP}`) ?? false);
  check("segment created from batch", confirm.segmentId !== null);

  const alice = await db.contact.findUnique({
    where: { workspaceId_email: { workspaceId: ws.id, email: `alice.${STAMP}@example.com` } },
    include: { sources: true, consents: true },
  });
  check("source ledger row written", (alice?.sources.length ?? 0) >= 1);
  check("consent ledger row written (granted)", alice?.consents.some((c) => c.channel === "email" && c.status === "granted") ?? false);

  const carol = await db.contact.findUnique({
    where: { workspaceId_email: { workspaceId: ws.id, email: `carol.${STAMP}@example.com` } },
    include: { consents: true },
  });
  check("no-consent row held as pending, not granted", carol?.consents.every((c) => c.channel !== "email" || c.status === "pending") ?? false);

  console.log("Suppression safety");
  await db.suppressionRecord.create({ data: { workspaceId: ws.id, email: `dave.${STAMP}@example.com`, reason: "unsubscribed" } });
  const batch2 = await createBatchFromCsv({
    workspaceId: ws.id, name: `Test suppression ${STAMP}`, source: "test", sourceType: "import",
    uploadedBy: "test-script", csv: `email,gdpr_optin\ndave.${STAMP}@example.com,TRUE`,
  });
  const review2 = await reviewBatch(batch2.batchId, batch2.mapping);
  check("suppressed contact blocked on re-upload", review2.counts.blocked === 1);

  console.log("Event ingestion + scoring");
  const before = await db.event.count({ where: { workspaceId: ws.id } });
  await eventIngestionService.process({
    workspaceId: ws.id, type: "product_viewed", email: `alice.${STAMP}@example.com`,
    payload: { productTitle: "NAD+ Cellular Complex", source: "tracker" },
  });
  await eventIngestionService.process({
    workspaceId: ws.id, type: "checkout_started", email: `alice.${STAMP}@example.com`,
    payload: { total: 68, itemCount: 1, source: "tracker" },
  });
  const after = await db.event.count({ where: { workspaceId: ws.id } });
  check("events stored", after === before + 2);

  const tl = await db.timelineItem.count({ where: { contactId: alice!.id } });
  check("timeline items created", tl >= 2);

  const score = await recomputeLeadScore(alice!.id);
  check("score reflects view + checkout (50)", score.score === 50, `got ${score.score}`);
  check("reasons are transparent", score.reasons.length >= 2);
  check("status is hot at 50", score.status === "hot", score.status);

  console.log("Anonymous events stay aggregate");
  const contactsBefore = await db.contact.count({ where: { workspaceId: ws.id } });
  await eventIngestionService.process({
    workspaceId: ws.id, type: "search", anonymousId: "anon-test-1",
    payload: { term: `test term ${STAMP}`, resultCount: 0, source: "tracker" },
  });
  const contactsAfter = await db.contact.count({ where: { workspaceId: ws.id } });
  check("anonymous search creates no contact", contactsAfter === contactsBefore);
  const signal = await db.demandSignal.findFirst({ where: { workspaceId: ws.id, term: `test term ${STAMP}` } });
  check("anonymous search recorded as demand signal", signal !== null && signal.note?.includes("missed") === true);

  console.log("Segment engine");
  const seg = await evaluateSegment(ws.id, "all", [
    { field: "Tag", operator: "is", value: `test-${STAMP}` },
  ]);
  check("segment finds tagged imports", seg.count === 2, `got ${seg.count}`); // alice + carol (duplicate merges into alice)
  const segExcl = await evaluateSegment(ws.id, "all", [
    { field: "Tag", operator: "is", value: `test-${STAMP}` },
    { field: "Lead score", operator: "is at least", value: "50", exclude: true },
  ]);
  check("exclusion rules subtract", segExcl.count < seg.count, `${segExcl.count} vs ${seg.count}`);

  console.log("Universal Inbox extraction + approval");
  const intake = await createIntakeFromText({
    workspaceId: ws.id, kind: "whatsapp", actor: "test-script",
    text: `Tessa Vine +44 7700 900${STAMP.slice(-3)} asked about NAD+ and a consultation. Call tomorrow.`,
  });
  check("one record extracted", intake.records.length === 1);
  const rec = intake.records[0];
  const f = JSON.parse(rec.fields);
  check("name, phone, interests, task all found", f.name === "Tessa Vine" && !!f.phone && f.interests.includes("nad+") && !!f.taskNote);

  const approval = await approveRecord(rec.id, "test-script");
  check("approval created a contact", !!approval.contactId);
  check("approval created a sales task", !!approval.taskId);
  const tessa = await db.contact.findUnique({
    where: { id: approval.contactId! },
    include: { sources: true, consents: true, tags: { include: { tag: true } } },
  });
  check("phone-only contact allowed (no email)", tessa?.email === null);
  check("intake source appended", tessa?.sources.some((s) => s.sourceType === "whatsapp") ?? false);
  check("consent held pending, not granted", tessa?.consents.every((c) => c.status === "pending") ?? false);
  check("interest tags applied", (tessa?.tags.length ?? 0) >= 1);

  console.log("Storefront vs backend domain rules");
  {
    const { classifyTrackingSource } = await import("../lib/server/tracking-domains");
    const base = { allowed: "myotech.store", backend: "api.myotech.store" };
    check("storefront origin accepted", classifyTrackingSource({ origin: "https://myotech.store", ...base }).ok === true);
    check("www variant accepted", classifyTrackingSource({ origin: "https://www.myotech.store", ...base }).ok === true);
    check("api subdomain rejected", classifyTrackingSource({ origin: "https://api.myotech.store", ...base }).ok === false);
    check("listed backend domain rejected", classifyTrackingSource({ origin: "https://api.myotech.store", allowed: "myotech.store", backend: "api.myotech.store" }).ok === false);
    check("admin subdomain rejected", classifyTrackingSource({ origin: "https://admin.myotech.store", ...base }).ok === false);
    check("random subdomain no longer implicitly trusted", classifyTrackingSource({ origin: "https://evil.myotech.store", ...base }).ok === false);
    check("foreign origin rejected", classifyTrackingSource({ origin: "https://evil.example.com", ...base }).ok === false);
    check("wp-admin path rejected even on storefront", classifyTrackingSource({ origin: "https://myotech.store", payloadUrl: "/wp-admin/edit.php", ...base }).ok === false);
    check("wp-login rejected", classifyTrackingSource({ origin: "https://myotech.store", payloadUrl: "/wp-login.php?x=1", ...base }).ok === false);
    check("hostname fallback used when no origin", classifyTrackingSource({ origin: null, payloadHostname: "api.myotech.store", ...base }).ok === false);
    check("no host at all accepted (server-side QA)", classifyTrackingSource({ origin: null, ...base }).ok === true);
  }

  console.log("Event validation pipeline");
  {
    const { classifyEvent, scrubPayload } = await import("../lib/server/ingest-pipeline");
    const liveStore = { id: "s1", domains: "myotech.store", backendDomains: "api.myotech.store", trackingMode: "live" };
    const testStore = { ...liveStore, trackingMode: "test" };

    const a = classifyEvent({ type: "product_viewed", payload: { source: "tracker", hostname: "myotech.store", url: "/p/x" }, origin: "https://myotech.store", store: liveStore });
    check("tracker storefront event → storefront stream", a.action === "accept" && a.stream === "storefront");
    const b = classifyEvent({ type: "checkout_completed", payload: { source: "plugin" }, store: liveStore });
    check("plugin commerce event → server stream", b.action === "accept" && b.stream === "server");
    const c = classifyEvent({ type: "page_viewed", payload: { source: "qa-panel", url: "/qa-test" }, store: liveStore });
    check("qa-panel event → test stream", c.action === "accept" && c.stream === "test");
    const d = classifyEvent({ type: "page_viewed", payload: { source: "tracker", hostname: "myotech.store", url: "/p", context: "internal" }, origin: "https://myotech.store", store: liveStore });
    check("logged-in staff → internal stream", d.action === "accept" && d.stream === "internal");
    const e2 = classifyEvent({ type: "product_viewed", payload: { source: "tracker", hostname: "myotech.store", url: "/p" }, origin: "https://myotech.store", store: testStore });
    check("test-mode store forces test stream", e2.action === "accept" && e2.stream === "test");
    const f = classifyEvent({ type: "product_viewed", payload: {}, store: liveStore });
    check("product_viewed from unmarked system source quarantined", f.action === "quarantine");
    const g = classifyEvent({ type: "purchase_completed", payload: { source: "tracker", hostname: "myotech.store" }, origin: "https://myotech.store", store: liveStore });
    check("browser cannot fabricate purchase_completed", g.action === "quarantine");
    const h = classifyEvent({ type: "page_viewed", payload: { source: "tracker", hostname: "api.myotech.store" }, origin: "https://api.myotech.store", store: liveStore });
    check("backend host rejected in pipeline too", h.action === "reject");
    const i = classifyEvent({ type: "page_viewed", payload: { source: "tracker", hostname: "myotech.store", url: "/wp-json/wc/v3" }, origin: "https://myotech.store", store: liveStore });
    check("wp-json on storefront host rejected", i.action === "reject");
    const j = classifyEvent({ type: "page_viewed", payload: { source: "tracker", hostname: "myotech.store", url: "/p" }, origin: "https://myotech.store", occurredAt: new Date(Date.now() + 60 * 60 * 1000), store: liveStore });
    check("future timestamp quarantined", j.action === "quarantine");
    const k = classifyEvent({ type: "page_viewed", payload: { source: "tracker", hostname: "myotech.store", url: "/p" }, origin: "https://myotech.store", occurredAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), store: liveStore });
    check("stale timestamp quarantined", k.action === "quarantine");
    const s = scrubPayload({ url: "/checkout?token=abc&utm_source=fb", password: "x", card_number: "4111", productId: "9" });
    check("scrubber strips credentials and sensitive query params", s !== undefined && !("password" in s) && !("card_number" in s) && s.url === "/checkout?utm_source=fb" && s.productId === "9");
    const m = classifyEvent({ type: "email_open", payload: {}, store: null });
    check("system events without store still accepted", m.action === "accept");
  }

  console.log("Data library folders");
  {
    const folder = await db.dataFolder.create({ data: { workspaceId: ws.id, name: `Shelf ${STAMP}`, createdBy: "test-script" } });
    const anyBatch = await db.importBatch.findFirstOrThrow({ where: { workspaceId: ws.id } });
    await db.importBatch.update({ where: { id: anyBatch.id }, data: { folderId: folder.id } });
    const inFolder = await db.importBatch.count({ where: { folderId: folder.id } });
    check("batch filed into folder", inFolder === 1);
    const dupe = await db.dataFolder.create({ data: { workspaceId: ws.id, name: `Shelf ${STAMP}`, createdBy: "x" } }).catch(() => null);
    check("duplicate folder names refused", dupe === null);
    await db.importBatch.update({ where: { id: anyBatch.id }, data: { folderId: null } });
    await db.dataFolder.delete({ where: { id: folder.id } });
    check("empty folder deletable", (await db.dataFolder.findUnique({ where: { id: folder.id } })) === null);
  }

  console.log("Campaign send path");
  // Deterministic suppressed-contact case (must not depend on leftover data):
  // a contact exists AND its email is on the suppression list.
  await db.contact.create({
    data: { workspaceId: ws.id, email: `held.${STAMP}@example.com`, firstName: "Held" },
  });
  await db.suppressionRecord.create({
    data: { workspaceId: ws.id, email: `held.${STAMP}@example.com`, reason: "unsubscribed" },
  });
  const camp = await db.campaign.create({
    data: { workspaceId: ws.id, name: `Send test ${STAMP}`, subject: "Test", status: "draft" },
  });
  const sendResult = await sendCampaign(camp.id, "test-script");
  check("send succeeded via provider", sendResult.ok === true);
  if (sendResult.ok) {
    check("dev transport used (no SES creds)", sendResult.provider === "dev-log");
    check("consent skips reported", sendResult.skippedConsent >= 1);
    check("suppressed contacts skipped", sendResult.skippedSuppressed >= 1);
    const sendRows = await db.campaignSend.count({ where: { campaignId: camp.id, status: "sent" } });
    check("send rows recorded", sendRows === sendResult.sent);
  }
  const resent = await sendCampaign(camp.id, "test-script");
  check("double-send blocked", resent.ok === false);

  console.log("Auth rate limiting");
  const key = `test:${STAMP}`;
  let allowed = 0;
  for (let i = 0; i < 12; i++) if (checkRateLimit(key)) allowed++;
  check("allows 10 then blocks", allowed === 10, `allowed ${allowed}`);

  console.log("Cart lifecycle");
  const store = await db.store.findFirstOrThrow({ where: { workspaceId: ws.id } });
  const token = `test-cart-${STAMP}`;
  await touchCart(store.id, "cart_add", { cartToken: token, items: [{ productId: "101", title: "Test", qty: 1, price: 68 }], total: 68 }, null);
  let cart = await db.cart.findUnique({ where: { token } });
  check("cart created open", cart?.status === "open");
  await touchCart(store.id, "checkout_started", { cartToken: token, total: 68 }, null);
  cart = await db.cart.findUnique({ where: { token } });
  check("checkout started", cart?.status === "checkout_started");
  // Backdate activity past the 30-minute checkout threshold, then sweep.
  await db.cart.update({ where: { token }, data: { lastActivityAt: new Date(Date.now() - 45 * 60_000) } });
  await sweepAbandoned(true);
  cart = await db.cart.findUnique({ where: { token } });
  check("swept to abandoned_checkout", cart?.status === "abandoned_checkout");
  check("recovery token exists", !!cart?.recoveryToken);
  await touchCart(store.id, "purchase_completed", { cartToken: token, total: 68 }, null);
  cart = await db.cart.findUnique({ where: { token } });
  check("purchase converts (not recovered: no link click)", cart?.status === "converted");

  await platformTests(ws.id);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

async function platformTests(wsId: string) {
  console.log("Integration Platform");
  const { NextRequest } = await import("next/server");
  const platform = await import("../lib/server/platform");
  const { GET: pingGet } = await import("../app/api/v1/ping/route");
  const { GET: contactsGet, POST: contactsPost } = await import("../app/api/v1/contacts/route");
  const { GET: segmentsGet } = await import("../app/api/v1/segments/route");
  const { POST: trackPost } = await import("../app/api/v1/track/route");
  const { POST: testSession } = await import("../app/api/auth/test-session/route");
  const devAccess = await import("../lib/server/dev-access");

  const integ = await db.integration.upsert({
    where: { workspaceId_slug: { workspaceId: wsId, slug: "custom-api" } },
    create: { workspaceId: wsId, slug: "custom-api", name: "Custom API", kind: "custom" },
    update: {},
  });

  // Key auth + permissions
  const full = await platform.createApiKey({
    workspaceId: wsId, integrationId: integ.id, name: `flows ${STAMP}`,
    permissions: ["contacts:read", "contacts:write", "events:write", "webhooks:manage"],
  });
  const req = (url: string, key: string, init?: RequestInit) =>
    new NextRequest(`http://localhost${url}`, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(init?.headers ?? {}) } } as ConstructorParameters<typeof NextRequest>[1]);

  let res = await pingGet(req("/api/v1/ping", full.secretKey));
  check("valid key pings 200", res.status === 200);
  res = await pingGet(req("/api/v1/ping", full.secretKey.slice(0, -2) + "xx"));
  check("tampered secret rejected 401", res.status === 401);
  res = await pingGet(req("/api/v1/ping", "sk_live_nope_abcdef"));
  check("unknown key rejected 401", res.status === 401);
  res = await segmentsGet(req("/api/v1/segments", full.secretKey));
  check("missing permission rejected 403", res.status === 403);

  // Contact sync + consent + update path
  const email = `platform.${STAMP}@example.com`;
  res = await contactsPost(req("/api/v1/contacts", full.secretKey, { method: "POST", body: JSON.stringify({ email, firstName: "Plat", consent: { channel: "email", status: "granted", wording: "flows consent" }, attribution: { referralCode: "IB-1" } }) }));
  check("contact create 201", res.status === 201);
  res = await contactsPost(req("/api/v1/contacts", full.secretKey, { method: "POST", body: JSON.stringify({ email, lastName: "Form" }) }));
  const upd = await res.json();
  check("second post updates not creates", res.status === 200 && upd.contact.created === false);
  const contact = await db.contact.findUnique({ where: { workspaceId_email: { workspaceId: wsId, email } } });
  check("contact persisted with fields", contact?.firstName === "Plat" && contact?.lastName === "Form");
  const consent = await db.consentRecord.findFirst({ where: { contactId: contact!.id }, orderBy: { id: "desc" } });
  check("consent recorded with wording", consent?.evidence === "flows consent");

  // Lifecycle events
  res = await trackPost(req("/api/v1/track", full.secretKey, { method: "POST", body: JSON.stringify({ event: "custom.flows.test", email, data: { n: 1 } }) }));
  check("track accepts 202", res.status === 202);
  const tl = await db.timelineItem.findFirst({ where: { contactId: contact!.id, title: "custom.flows.test" } });
  check("event lands on contact timeline", !!tl);

  // Rotation kills the old secret
  const rotated = await platform.rotateApiKey(full.keyId, "flows");
  res = await pingGet(req("/api/v1/ping", full.secretKey));
  check("rotated-out secret rejected", res.status === 401);
  res = await pingGet(req("/api/v1/ping", rotated!.secretKey));
  check("rotated-in secret accepted", res.status === 200);

  // Tenant isolation: a second workspace's key can't see this workspace
  const ws2 = await db.workspace.create({ data: { name: `Flows Tenant ${STAMP}` } });
  const integ2 = await db.integration.create({ data: { workspaceId: ws2.id, slug: "custom-api", name: "Custom API", kind: "custom" } });
  const key2 = await platform.createApiKey({ workspaceId: ws2.id, integrationId: integ2.id, name: "tenant2", permissions: ["contacts:read", "contacts:write"] });
  res = await contactsGet(req(`/api/v1/contacts?email=${encodeURIComponent(email)}`, key2.secretKey));
  const iso = await res.json();
  check("tenant B cannot read tenant A contact", res.status === 200 && iso.count === 0);
  res = await contactsPost(req("/api/v1/contacts", key2.secretKey, { method: "POST", body: JSON.stringify({ email }) }));
  check("tenant B upsert creates its own copy", res.status === 201);
  const aCopies = await db.contact.count({ where: { workspaceId: wsId, email } });
  check("tenant A unaffected by tenant B write", aCopies === 1);

  // Rate limiting (pure limiter check)
  let allowed = 0;
  for (let i = 0; i < 125; i++) if (checkRateLimit(`apikey:flows-${STAMP}`, 120, 60_000)) allowed++;
  check("rate limiter caps at 120/min", allowed === 120);

  // Webhook delivery + signature + retry
  const http = await import("node:http");
  const seen: { sig: string | null; body: string }[] = [];
  const server = http.createServer((rq, rs) => {
    let b = "";
    rq.on("data", (c) => (b += c));
    rq.on("end", () => { seen.push({ sig: rq.headers["x-sendloom-signature"] as string ?? null, body: b }); rs.writeHead(200); rs.end("ok"); });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  const ep = await db.webhookEndpoint.create({ data: { workspaceId: wsId, integrationId: integ.id, url: `http://127.0.0.1:${port}/hook`, secret: "whsec_flows_secret", events: JSON.stringify(["*"]) } });
  await platform.dispatchPlatformEvent(wsId, "webhook.test", { flows: STAMP });
  const okDel = await db.webhookDelivery.findFirst({ where: { endpointId: ep.id }, orderBy: { createdAt: "desc" } });
  check("webhook delivered", okDel?.status === "success" && seen.length === 1);
  const crypto = await import("node:crypto");
  const parts = Object.fromEntries((seen[0]?.sig ?? "").split(",").map((p) => p.split("=") as [string, string]));
  const expect = crypto.createHmac("sha256", "whsec_flows_secret").update(`${parts.t}.${seen[0]?.body}`).digest("hex");
  check("webhook signature verifies", parts.v1 === expect);

  // Failure → retry schedule → recovery
  await db.webhookEndpoint.update({ where: { id: ep.id }, data: { url: "http://127.0.0.1:1/hook" } });
  await platform.dispatchPlatformEvent(wsId, "webhook.test", { flows: `${STAMP}-fail` });
  let failDel = await db.webhookDelivery.findFirst({ where: { endpointId: ep.id, status: "failed" }, orderBy: { createdAt: "desc" } });
  check("failed delivery queued for retry", !!failDel?.nextRetryAt && failDel.attempts === 1);
  await db.webhookEndpoint.update({ where: { id: ep.id }, data: { url: `http://127.0.0.1:${port}/hook` } });
  await db.webhookDelivery.update({ where: { id: failDel!.id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
  await platform.retryDueWebhooks();
  failDel = await db.webhookDelivery.findUnique({ where: { id: failDel!.id } });
  check("retry recovers to success", failDel?.status === "success");
  server.close();

  // Production guards
  const env = process.env.NODE_ENV;
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  delete process.env.SENDLOOM_ALLOW_TEST_AUTH;
  check("dev access dead in production", devAccess.devAccessAllowed() === false);
  const prodRes = await testSession(new NextRequest("http://localhost/api/auth/test-session", { method: "POST", headers: { "x-sendloom-test-secret": process.env.SENDLOOM_TEST_AUTH_SECRET ?? "x" } } as ConstructorParameters<typeof NextRequest>[1]));
  check("test-session 404s in production", prodRes.status === 404);
  (process.env as Record<string, string | undefined>).NODE_ENV = env;

  // Cleanup tenant B (children first: sources, timeline, consent, events)
  const bIds = (await db.contact.findMany({ where: { workspaceId: ws2.id }, select: { id: true } })).map((c) => c.id);
  await db.contactSource.deleteMany({ where: { contactId: { in: bIds } } });
  await db.timelineItem.deleteMany({ where: { contactId: { in: bIds } } });
  await db.consentRecord.deleteMany({ where: { contactId: { in: bIds } } });
  await db.event.deleteMany({ where: { workspaceId: ws2.id } });
  await db.auditLog.deleteMany({ where: { workspaceId: ws2.id } }).catch(() => {});
  await db.contact.deleteMany({ where: { workspaceId: ws2.id } });
  await db.apiKey.deleteMany({ where: { workspaceId: ws2.id } });
  await db.integration.deleteMany({ where: { workspaceId: ws2.id } });
  await db.workspace.delete({ where: { id: ws2.id } });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
