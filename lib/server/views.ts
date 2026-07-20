// Shapes Prisma rows into the view types the existing UI components consume
// (lib/data.ts types). Keeps page rewiring to import swaps.
import { db } from "./db";
import type { Subscriber, TimelineEvent, ImportBatch, SalesTask, Segment, Keyword, SiteSearch, Opportunity, Provider, Campaign } from "@/lib/data";

export async function demoWorkspaceId(): Promise<string> {
  const ws = await db.workspace.findFirstOrThrow();
  return ws.id;
}

const consentView: Record<string, Subscriber["consent"]> = {
  granted: "subscribed", withdrawn: "unsubscribed", pending: "pending", suppressed: "suppressed",
};

function relTime(d: Date | null): string {
  if (!d) return "–";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days} day${days > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function dateStr(d: Date | null): string {
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never";
}

export async function getContactsView(): Promise<Subscriber[]> {
  const wsId = await demoWorkspaceId();
  const contacts = await db.contact.findMany({
    where: { workspaceId: wsId },
    include: {
      tags: { include: { tag: true } },
      sources: { orderBy: { createdAt: "asc" } },
      consents: { orderBy: { createdAt: "desc" } },
      score: true,
    },
    orderBy: { lastActivityAt: "desc" },
  });

  return contacts.map((c) => {
    const email = c.consents.find((x) => x.channel === "email");
    const status = (c.score?.status ?? "cold") === "vip" ? "VIP" : ((c.score?.status ?? "cold") as Subscriber["status"]);
    const chan = (ch: string) => c.consents.find((x) => x.channel === ch)?.status === "granted";
    return {
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.phone || "Unknown",
      email: c.email ?? (c.phone ? `phone-only · ${c.phone}` : "no contact route"),
      phone: c.phone ?? undefined,
      location: [c.city, c.country === "United Kingdom" ? "UK" : c.country === "Ireland" ? "IE" : c.country].filter(Boolean).join(", "),
      consent: consentView[email?.status ?? "pending"],
      source: c.sources[0]?.source ?? "Unknown",
      lawfulBasis: email?.lawfulBasis ?? "Not recorded",
      channels: { email: chan("email"), sms: chan("sms"), whatsapp: chan("whatsapp"), phone: chan("phone"), adExport: chan("ad_export") },
      confidence: c.confidence,
      signup: dateStr(c.createdAt),
      tags: c.tags.map((t) => t.tag.name),
      lists: [],
      orders: c.ordersCount,
      revenue: c.revenue,
      aov: c.ordersCount ? c.revenue / c.ordersCount : 0,
      lastOrder: dateStr(c.lastOrderAt),
      lastActivity: relTime(c.lastActivityAt),
      engagement: c.engagement as Subscriber["engagement"],
      score: c.score?.score ?? 0,
      status,
      scoreReasons: c.score ? JSON.parse(c.score.reasons) : [],
    };
  });
}

export async function getContactView(id: string) {
  const all = await getContactsView();
  const contact = all.find((c) => c.id === id) ?? null;
  if (!contact) return null;

  const [timeline, enrichments, tasks] = await Promise.all([
    db.timelineItem.findMany({ where: { contactId: id }, orderBy: { occurredAt: "desc" }, take: 40 }),
    db.enrichmentRecord.findMany({ where: { contactId: id } }),
    db.salesTask.findMany({ where: { contactId: id, status: "open" } }),
  ]);

  const events: TimelineEvent[] = timeline.map((t) => ({
    time: relTime(t.occurredAt),
    type: (t.type in TL_TYPE_MAP ? TL_TYPE_MAP[t.type] : "view") as TimelineEvent["type"],
    title: t.title,
    detail: t.detail ?? "",
    value: t.value ?? undefined,
  }));

  return {
    contact,
    events,
    enrichments: enrichments.map((e) => ({
      provider: e.provider, fields: JSON.parse(e.fieldsAdded).join(", "),
      confidence: e.confidence, when: dateStr(e.createdAt), cost: `£${e.cost.toFixed(3)}`,
    })),
    openTasks: tasks.map((t) => ({ type: t.type, note: t.note ?? "" })),
  };
}

const TL_TYPE_MAP: Record<string, string> = {
  product_viewed: "view", category_viewed: "view", view: "view",
  search: "search", cart_add: "cart", cart: "cart",
  checkout_started: "checkout", checkout: "checkout",
  purchase_completed: "purchase", purchase: "purchase",
  email_open: "email_open", email_click: "email_click", email_sent: "email_sent",
  imported: "import", import: "import", consent_recorded: "signup", signup: "signup",
  quiz_completed: "signup", guide_downloaded: "signup", newsletter_signup: "signup",
  enrichment_completed: "enrich", task_created: "task", task: "task",
  score_changed: "score", score: "score", automation: "automation",
};

const batchStatusView: Record<string, ImportBatch["status"]> = {
  complete: "complete", needs_review: "needs review", review: "needs review",
  mapping: "processing", importing: "processing", blocked: "blocked",
};

export async function getImportBatchesView(): Promise<ImportBatch[]> {
  const wsId = await demoWorkspaceId();
  const batches = await db.importBatch.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" }, include: { folder: { select: { id: true, name: true } } } });
  return batches.map((b) => ({
    id: b.id, name: b.name, source: b.source, format: b.format.toUpperCase(),
    folderId: b.folder?.id ?? null, folderName: b.folder?.name ?? null,
    date: dateStr(b.createdAt), uploadedBy: b.uploadedBy,
    total: b.totalRows, ready: b.readyRows, duplicates: b.duplicateRows,
    merged: b.mergedRows, blocked: b.blockedRows, missingConsent: b.missingConsentRows,
    status: batchStatusView[b.status] ?? "complete", revenue: b.revenue,
  }));
}

export async function getCampaignsView(): Promise<Campaign[]> {
  const wsId = await demoWorkspaceId();
  const campaigns = await db.campaign.findMany({
    where: { workspaceId: wsId },
    include: { sends: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return campaigns.map((c) => {
    const delivered = c.sends.filter((s) => s.status === "sent").length;
    const opened = c.sends.filter((s) => s.openedAt).length;
    const clicked = c.sends.filter((s) => s.clickedAt).length;
    return {
      id: c.id, name: c.name, subject: c.subject ?? "",
      status: c.status as Campaign["status"],
      audience: c.audienceRef ?? "All contacts",
      recipients: c.audienceSnapshot,
      sentAt: c.sentAt ? dateStr(c.sentAt) : c.scheduledAt ? dateStr(c.scheduledAt) : "Not scheduled",
      openRate: c.isDemo ? c.openRate : delivered ? Math.round((opened / delivered) * 1000) / 10 : 0,
      clickRate: c.isDemo ? c.clickRate : delivered ? Math.round((clicked / delivered) * 1000) / 10 : 0,
      revenue: c.revenue,
      isDemo: c.isDemo,
      delivered, opened, clicked,
    };
  });
}

export async function getAutomationsView() {
  const wsId = await demoWorkspaceId();
  const autos = await db.automation.findMany({
    where: { workspaceId: wsId },
    include: { nodes: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return autos.map((a) => ({
    id: a.id, name: a.name, trigger: a.trigger,
    status: a.status as "live" | "paused" | "draft",
    isDemo: a.isDemo,
    entered: a.entered, completed: a.completed, revenue: a.revenue, conversion: a.conversion,
    nodes: a.nodes.filter((n) => !n.branch).map((n) => ({ id: n.id, kind: n.kind, label: n.label, detail: n.detail ?? "", stats: n.stats ?? undefined })),
    branches: a.nodes.some((n) => n.branch)
      ? {
          at: a.nodes.filter((n) => !n.branch).at(-1)?.id ?? "",
          yes: a.nodes.filter((n) => n.branch === "yes").map((n) => ({ id: n.id, kind: n.kind, label: n.label, detail: n.detail ?? "", stats: n.stats ?? undefined })),
          no: a.nodes.filter((n) => n.branch === "no").map((n) => ({ id: n.id, kind: n.kind, label: n.label, detail: n.detail ?? "", stats: n.stats ?? undefined })),
        }
      : undefined,
  }));
}

export async function getFormsView() {
  const wsId = await demoWorkspaceId();
  const forms = await db.form.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "asc" } });
  return forms.map((f) => ({
    id: f.id, name: f.name,
    type: f.type.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
    trigger: f.trigger ?? "", status: f.status as "live" | "paused" | "draft",
    views: f.views, signups: f.signups, isDemo: f.isDemo,
  }));
}

export async function workspaceIsClean(): Promise<boolean> {
  const wsId = await demoWorkspaceId();
  const contacts = await db.contact.count({ where: { workspaceId: wsId } });
  return contacts === 0;
}

export async function getSegmentsView(): Promise<Segment[]> {
  const wsId = await demoWorkspaceId();
  const segments = await db.segment.findMany({ where: { workspaceId: wsId }, include: { rules: true }, orderBy: { createdAt: "asc" } });
  return segments.map((s) => ({
    id: s.id, name: s.name, description: s.description ?? "",
    match: s.match as "all" | "any",
    conditions: s.rules.map((r) => ({ field: r.field, operator: r.operator, value: r.value })),
    count: s.count, revenue: s.revenue, updated: "Live",
  }));
}

export async function getTasksView(): Promise<SalesTask[]> {
  const wsId = await demoWorkspaceId();
  const tasks = await db.salesTask.findMany({ where: { workspaceId: wsId }, orderBy: { dueAt: "asc" } });
  return tasks.map((t) => ({
    id: t.id, type: t.type, contact: t.contactLabel ?? "Unknown",
    contactId: t.contactId ?? undefined,
    due: t.dueAt ? (t.dueAt < new Date() && t.status === "open" ? "Yesterday" : relTime(t.dueAt).includes("ago") ? dateStr(t.dueAt) : "Today") : "–",
    priority: t.priority as SalesTask["priority"],
    status: t.status === "open" && t.dueAt && t.dueAt < new Date() ? "overdue" : (t.status as SalesTask["status"]),
    note: t.note ?? "", assignee: t.assigneeLabel ?? "Unassigned",
    source: t.source,
  }));
}

export async function getKeywordsView(): Promise<Keyword[]> {
  const wsId = await demoWorkspaceId();
  const keywords = await db.keyword.findMany({ where: { workspaceId: wsId }, include: { cluster: true } });
  return keywords.map((k) => ({
    term: k.term, cluster: k.cluster?.name ?? "–", volume: k.volume, trend: k.trend,
    cpc: `£${k.cpc.toFixed(2)}`, seo: k.seoDifficulty,
    intent: k.intent as Keyword["intent"],
    review: k.review.replace("_", " ") as Keyword["review"],
  }));
}

export async function getOpportunitiesView(): Promise<Opportunity[]> {
  const wsId = await demoWorkspaceId();
  const clusters = await db.keywordCluster.findMany({ where: { workspaceId: wsId, opportunityScore: { gt: 0 } }, orderBy: { opportunityScore: "desc" } });
  return clusters.map((c) => ({
    cluster: c.name, score: c.opportunityScore, demand: c.demandNote ?? "",
    have: c.haveAssets ? JSON.parse(c.haveAssets) : [],
    missing: c.missingAssets ? JSON.parse(c.missingAssets) : [],
  }));
}

export async function getSiteSearchView(): Promise<SiteSearch[]> {
  const wsId = await demoWorkspaceId();
  const signals = await db.demandSignal.findMany({
    where: { workspaceId: wsId, kind: "site_search_term" }, orderBy: { metric: "desc" },
  });
  return signals.map((s) => ({
    term: s.term, searches: Math.round(s.metric), trend: s.trend,
    conversion: s.conversion, revenue: s.revenue, note: s.note ?? undefined,
  }));
}

export async function getProvidersView(): Promise<Provider[]> {
  const wsId = await demoWorkspaceId();
  const provs = await db.dataProvider.findMany({ where: { workspaceId: wsId } });
  return provs.map((p) => ({
    name: p.name,
    type: p.type.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
    status: p.status.replace("_", " ") as Provider["status"],
    lastSync: p.lastSyncAt ? relTime(p.lastSyncAt) : "–",
    note: p.note ?? "",
  }));
}

export async function getAuditView(take = 60) {
  const wsId = await demoWorkspaceId();
  const logs = await db.auditLog.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" }, take });
  return logs.map((l) => ({ time: relTime(l.createdAt), who: l.actorLabel, action: l.action, what: l.detail ?? l.action }));
}
