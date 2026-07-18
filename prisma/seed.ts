// Seeds the demo workspace. Everything seeded here is flagged demo where the
// schema supports it; imports/contacts/events are real rows exercising the
// same code paths as live data.
import { PrismaClient } from "@prisma/client";
import {
  subscribers, timelines, segments, campaigns, automations, forms,
  importBatches, keywords, opportunities, siteSearches, salesTasks, providers,
} from "../lib/data";

const db = new PrismaClient();

const DEMO_API_KEY = "slm_live_demo_vitalis_4f2a";

function nameParts(full: string) {
  const [firstName, ...rest] = full.split(" ");
  return { firstName, lastName: rest.join(" ") || null };
}

const consentToStatus: Record<string, string> = {
  subscribed: "granted",
  unsubscribed: "withdrawn",
  pending: "pending",
  suppressed: "suppressed",
};

export async function main() {
  console.log("Seeding…");

  const ws = await db.workspace.create({
    data: { name: "Vitalis Wellness & Longevity", sector: "health-wellness" },
  });

  const [steve, hannah] = await Promise.all([
    db.user.create({ data: { workspaceId: ws.id, email: "steve@vitaliswellness.co.uk", name: "Steve Clark", role: "owner", twoFactor: true } }),
    db.user.create({ data: { workspaceId: ws.id, email: "hannah@vitaliswellness.co.uk", name: "Hannah Morris", role: "marketing", twoFactor: true } }),
  ]);
  await db.user.create({ data: { workspaceId: ws.id, email: "hello@studionorth.co", name: "Studio North", role: "editor" } });
  await db.user.create({ data: { workspaceId: ws.id, email: "accounts@vitaliswellness.co.uk", name: "Finance shared", role: "viewer" } });

  const store = await db.store.create({
    data: {
      workspaceId: ws.id, name: "Vitalis Wellness & Longevity", url: "vitaliswellness.co.uk",
      apiKey: DEMO_API_KEY, status: "connected", lastSyncAt: new Date(), pluginVersion: "2.0.1",
    },
  });

  // Products
  const productDefs = [
    { externalId: "101", title: "NAD+ Cellular Complex", sku: "VIT-NAD-60", price: 68, categories: ["Longevity"] },
    { externalId: "102", title: "Marine Collagen Peptides", sku: "VIT-COL-30", price: 42, categories: ["Beauty"] },
    { externalId: "103", title: "Deep Sleep Magnesium", sku: "VIT-MAG-90", price: 29, categories: ["Sleep"] },
    { externalId: "104", title: "Recovery Complex", sku: "VIT-REC-60", price: 54, categories: ["Recovery"] },
    { externalId: "105", title: "Metabolic Support Complex", sku: "VIT-MET-60", price: 74, categories: ["Metabolic Support"] },
    { externalId: "106", title: "Longevity Stack bundle", sku: "VIT-LON-BND", price: 149, categories: ["Longevity"] },
  ];
  for (const p of productDefs) {
    await db.product.create({
      data: { storeId: store.id, externalId: p.externalId, title: p.title, sku: p.sku, price: p.price, categories: JSON.stringify(p.categories), url: `https://vitaliswellness.co.uk/products/${p.sku.toLowerCase()}` },
    });
  }

  // Import batches (created first so contact sources can reference them)
  const batchIds: Record<string, string> = {};
  const statusMap: Record<string, string> = { complete: "complete", "needs review": "needs_review", processing: "importing", blocked: "blocked" };
  for (const b of importBatches) {
    const created = await db.importBatch.create({
      data: {
        workspaceId: ws.id, name: b.name, source: b.source, format: b.format.toLowerCase(),
        uploadedBy: b.uploadedBy, status: statusMap[b.status] ?? "complete",
        totalRows: b.total, readyRows: b.ready, duplicateRows: b.duplicates, mergedRows: b.merged,
        blockedRows: b.blocked, missingConsentRows: b.missingConsent, revenue: b.revenue,
        completedAt: b.status === "complete" ? new Date() : null,
      },
    });
    batchIds[b.id] = created.id;
  }

  // Tags
  const tagNames = new Set<string>();
  subscribers.forEach((s) => s.tags.forEach((t) => tagNames.add(t)));
  subscribers.forEach((s) => s.lists.forEach((t) => tagNames.add(t)));
  const tagIds: Record<string, string> = {};
  for (const t of tagNames) {
    const tag = await db.tag.create({ data: { workspaceId: ws.id, name: t } });
    tagIds[t] = tag.id;
  }

  // Contacts + sources + consents + scores + timelines + events
  const contactIds: Record<string, string> = {};
  for (const s of subscribers) {
    const { firstName, lastName } = nameParts(s.name);
    const [city, country] = s.location.split(", ");
    const contact = await db.contact.create({
      data: {
        workspaceId: ws.id, email: s.email, firstName, lastName, phone: s.phone ?? null,
        city, country: country === "UK" ? "United Kingdom" : country === "IE" ? "Ireland" : country,
        confidence: s.confidence, engagement: s.engagement,
        ordersCount: s.orders, revenue: s.revenue,
        lastActivityAt: new Date(),
      },
    });
    contactIds[s.id] = contact.id;

    const isImport = s.source.startsWith("Import:");
    await db.contactSource.create({
      data: {
        contactId: contact.id, source: s.source,
        sourceType: isImport ? "import" : s.source.includes("Quiz") ? "quiz" : s.source.includes("popup") || s.source.includes("Popup") ? "popup" : s.source.includes("referral") || s.source.includes("Partner") ? "referral" : "checkout",
        importBatchId: isImport ? batchIds["imp_03"] : null,
        uploadedBy: isImport ? "Steve Clark" : null,
      },
    });

    // Consent rows per channel from the mock channel permissions
    const channels: [string, boolean][] = [
      ["email", s.channels.email], ["sms", s.channels.sms], ["whatsapp", s.channels.whatsapp],
      ["phone", s.channels.phone], ["ad_export", s.channels.adExport],
    ];
    for (const [channel, allowed] of channels) {
      await db.consentRecord.create({
        data: {
          contactId: contact.id, channel,
          status: channel === "email" ? consentToStatus[s.consent] : allowed ? "granted" : "withdrawn",
          lawfulBasis: s.lawfulBasis, evidence: s.source, actor: "seed",
        },
      });
    }

    for (const t of [...s.tags, ...s.lists]) {
      await db.contactTag.create({ data: { contactId: contact.id, tagId: tagIds[t] } });
    }

    await db.leadScore.create({
      data: {
        contactId: contact.id, score: s.score,
        status: s.status === "VIP" ? "vip" : s.status,
        reasons: JSON.stringify(s.scoreReasons),
      },
    });

    if (s.consent === "unsubscribed" || s.consent === "suppressed") {
      await db.suppressionRecord.create({
        data: { workspaceId: ws.id, email: s.email, reason: s.consent === "suppressed" ? "hard_bounce" : "unsubscribed", detail: "Seeded state" },
      });
    }

    const tl = timelines[s.id] ?? [];
    let minutesAgo = 60;
    for (const e of tl) {
      const when = new Date(Date.now() - minutesAgo * 60 * 1000);
      minutesAgo += 60 * 24; // walk backwards a day per item
      await db.timelineItem.create({
        data: { contactId: contact.id, type: e.type, title: e.title, detail: e.detail, value: e.value ?? null, occurredAt: when },
      });
      await db.event.create({
        data: { workspaceId: ws.id, storeId: store.id, contactId: contact.id, type: e.type, payload: JSON.stringify({ detail: e.detail }), occurredAt: when },
      });
    }
  }

  // A couple of real orders for rollups
  const orderDefs = [
    { sub: "sub_01", externalId: "42881", number: "#42881", total: 214, items: [{ id: "101", title: "NAD+ Cellular Complex", qty: 2 }, { id: "103", title: "Deep Sleep Magnesium", qty: 1 }] },
    { sub: "sub_10", externalId: "42897", number: "#42897", total: 149, items: [{ id: "106", title: "Longevity Stack bundle", qty: 1 }] },
    { sub: "sub_03", externalId: "42894", number: "#42894", total: 96.5, items: [{ id: "103", title: "Deep Sleep Magnesium", qty: 2 }] },
  ];
  for (const o of orderDefs) {
    await db.order.create({
      data: {
        storeId: store.id, contactId: contactIds[o.sub], externalId: o.externalId, number: o.number,
        status: "completed", total: o.total, items: JSON.stringify(o.items), placedAt: new Date(Date.now() - 9 * 24 * 3600 * 1000),
      },
    });
  }

  // Segments + rules
  for (const s of segments) {
    await db.segment.create({
      data: {
        workspaceId: ws.id, name: s.name, description: s.description, match: s.match,
        count: s.count, revenue: s.revenue, computedAt: new Date(),
        rules: { create: s.conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })) },
      },
    });
  }

  // Campaigns / automations / forms (demo-flagged performance)
  for (const c of campaigns) {
    await db.campaign.create({
      data: {
        workspaceId: ws.id, name: c.name, subject: c.subject, status: c.status,
        audienceType: "segment", audienceRef: c.audience, audienceSnapshot: c.recipients,
        openRate: c.openRate, clickRate: c.clickRate, revenue: c.revenue, isDemo: true,
        sentAt: c.status === "sent" ? new Date() : null,
      },
    });
  }
  for (const a of automations) {
    const allNodes = [
      ...a.nodes.map((n, i) => ({ ...n, position: i, branch: null as string | null })),
      ...(a.branches?.yes.map((n, i) => ({ ...n, position: i, branch: "yes" as string | null })) ?? []),
      ...(a.branches?.no.map((n, i) => ({ ...n, position: i, branch: "no" as string | null })) ?? []),
    ];
    await db.automation.create({
      data: {
        workspaceId: ws.id, name: a.name, trigger: a.trigger, status: a.status, isDemo: true,
        entered: a.entered, completed: a.completed, revenue: a.revenue, conversion: a.conversion,
        nodes: { create: allNodes.map((n) => ({ kind: n.kind, label: n.label, detail: n.detail, stats: n.stats ?? null, position: n.position, branch: n.branch })) },
      },
    });
  }
  for (const f of forms) {
    await db.form.create({
      data: { workspaceId: ws.id, name: f.name, type: f.type.toLowerCase().replace(/[ -]/g, "_"), trigger: f.trigger, status: f.status, views: f.views, signups: f.signups, isDemo: true },
    });
  }

  // Keywords, clusters, opportunities
  const clusterIds: Record<string, string> = {};
  for (const o of opportunities) {
    const c = await db.keywordCluster.create({
      data: {
        workspaceId: ws.id, name: o.cluster, opportunityScore: o.score, demandNote: o.demand,
        haveAssets: JSON.stringify(o.have), missingAssets: JSON.stringify(o.missing),
      },
    });
    clusterIds[o.cluster] = c.id;
  }
  for (const k of keywords) {
    if (!clusterIds[k.cluster]) {
      const c = await db.keywordCluster.create({ data: { workspaceId: ws.id, name: k.cluster } });
      clusterIds[k.cluster] = c.id;
    }
    await db.keyword.create({
      data: {
        workspaceId: ws.id, term: k.term, clusterId: clusterIds[k.cluster],
        volume: k.volume, trend: k.trend, cpc: parseFloat(k.cpc.replace("£", "")),
        seoDifficulty: k.seo, intent: k.intent, review: k.review.replace(" ", "_"),
      },
    });
  }

  // Demand signals: site search + questions + regional
  for (const s of siteSearches) {
    await db.demandSignal.create({
      data: {
        workspaceId: ws.id, source: "site_search", kind: "site_search_term", term: s.term,
        metric: s.searches, trend: s.trend, conversion: s.conversion, revenue: s.revenue, note: s.note ?? null,
      },
    });
  }
  const questions = [
    "Does NAD+ actually work for energy?",
    "How long does collagen take to show results?",
    "What supplements support GLP-1 medication?",
    "Best magnesium for deep sleep?",
  ];
  for (const q of questions) {
    await db.demandSignal.create({ data: { workspaceId: ws.id, source: "keyword_provider", kind: "question", term: q, note: q.includes("GLP-1") ? "restricted" : null } });
  }
  for (const [region, pct] of [["London & SE", 34], ["North West", 18], ["Scotland", 12], ["Midlands", 11], ["Other UK & IE", 25]] as [string, number][]) {
    await db.demandSignal.create({ data: { workspaceId: ws.id, source: "keyword_provider", kind: "regional", term: region, metric: pct } });
  }

  // Providers
  const provStatus: Record<string, string> = { healthy: "healthy", syncing: "syncing", error: "error", "not connected": "not_connected" };
  for (const p of providers) {
    await db.dataProvider.create({
      data: {
        workspaceId: ws.id, name: p.name, type: p.type.toLowerCase().replace(/ /g, "_"),
        status: provStatus[p.status], note: p.note,
        lastSyncAt: p.status === "healthy" ? new Date() : null,
        costMonth: p.name.includes("DataForSEO") ? 12.4 : 0,
      },
    });
  }

  // Sales tasks
  for (const t of salesTasks) {
    await db.salesTask.create({
      data: {
        workspaceId: ws.id,
        contactId: t.contactId ? contactIds[t.contactId] : null,
        contactLabel: t.contact, type: t.type, note: t.note, priority: t.priority,
        status: t.status === "overdue" ? "open" : t.status,
        source: t.note.includes("consultation") ? "automation" : "manual",
        assigneeId: t.assignee === "Hannah" ? hannah.id : t.assignee === "Steve" ? steve.id : null,
        assigneeLabel: t.assignee,
        dueAt: t.status === "overdue" ? new Date(Date.now() - 24 * 3600 * 1000) : new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
  }

  // Enrichment demo entries
  await db.enrichmentRecord.create({
    data: { contactId: contactIds["sub_04"], provider: "Dropcontact-style (EU)", fieldsAdded: JSON.stringify(["Company", "Job title", "City"]), confidence: 87, cost: 0.012, permission: "GDPR legitimate interest (B2B)" },
  });
  await db.enrichmentRecord.create({
    data: { contactId: contactIds["sub_08"], provider: "Hunter-style verification", fieldsAdded: JSON.stringify(["Email verified"]), confidence: 96, cost: 0.004 },
  });

  // Audit log
  const audits: [string, string, string][] = [
    ["system", "campaign.completed", "Campaign 'NAD+ Restock' completed · 9,204 delivered · 0 policy holds"],
    ["system", "import.review_complete", "Import 'Webinar attendees · July' quality review complete · 44 rows held for consent"],
    ["steve@vitaliswellness.co.uk", "keyword.classified", "Keyword 'semaglutide' classified Restricted (sector mode rule #12)"],
    ["hannah@vitaliswellness.co.uk", "import.created", "Uploaded import batch 'Webinar attendees · July' (1,240 rows)"],
    ["system", "import.blocked", "Import 'Purchased list · unknown origin' BLOCKED · no verifiable consent · operator notified"],
    ["studio-north@partner", "import.rejected", "Attempted upload 'prospects-q3.csv' · flagged by consent gate"],
  ];
  for (const [actorLabel, action, detail] of audits) {
    await db.auditLog.create({ data: { workspaceId: ws.id, actorLabel, action, detail } });
  }

  const { seedIntake } = await import("./seed-intake");
  await seedIntake(ws.id);
  const { seedUsers } = await import("./seed-users");
  await seedUsers(ws.id);

  console.log("Seed complete.");
  console.log(`Workspace: ${ws.id}`);
  console.log(`Store API key: ${DEMO_API_KEY}`);
}

if (process.argv[1]?.includes("seed.ts")) {
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => db.$disconnect());
}
