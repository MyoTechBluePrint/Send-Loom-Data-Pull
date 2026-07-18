// Segment rule evaluation against real contacts. Rules are evaluated in
// memory over a workspace-scoped candidate set; fine at prototype scale and
// swappable for compiled SQL later without changing the rule model.
import { db } from "./db";

export type Rule = { field: string; operator: string; value: string; exclude?: boolean };

type Ctx = {
  contact: Awaited<ReturnType<typeof loadContacts>>[number];
  suppressions: Set<string>;
};

async function loadContacts(workspaceId: string) {
  return db.contact.findMany({
    where: { workspaceId },
    include: {
      tags: { include: { tag: true } },
      sources: true,
      score: true,
      events: { where: { type: "search" }, take: 50 },
      consents: { orderBy: { createdAt: "desc" } },
    },
  });
}

function daysSince(d: Date | null): number {
  return d ? (Date.now() - d.getTime()) / (24 * 3600 * 1000) : Infinity;
}

function parseNumber(v: string): number {
  return parseFloat(v.replace(/[£,%\s]/g, "").replace("days ago", "")) || 0;
}

function matches(rule: Rule, ctx: Ctx): boolean {
  const c = ctx.contact;
  const v = rule.value.toLowerCase();
  const n = parseNumber(rule.value);
  const latestEmail = c.consents.find((x) => x.channel === "email");

  switch (rule.field) {
    case "Total spend":
      return rule.operator.includes("greater") || rule.operator.includes("at least") ? c.revenue >= n : c.revenue < n;
    case "Order count":
      if (rule.operator === "is exactly") return c.ordersCount === n;
      if (rule.operator.includes("at least") || rule.operator.includes("greater")) return c.ordersCount >= n;
      return c.ordersCount < n;
    case "Last order":
      return rule.operator.includes("more than") ? daysSince(c.lastOrderAt) > n : daysSince(c.lastOrderAt) <= n;
    case "Country":
      return (c.country ?? "").toLowerCase().includes(v);
    case "Tag":
      return c.tags.some((t) => t.tag.name.toLowerCase().includes(v));
    case "Source":
      return c.sources.some((s) => s.source.toLowerCase().includes(v) || s.sourceType.toLowerCase().includes(v));
    case "Import batch":
      return c.sources.some((s) => s.importBatchId === rule.value);
    case "Lead score":
      if (!c.score) return false;
      if (rule.operator.includes("at least") || rule.operator.includes("above") || rule.operator.includes("greater")) return c.score.score >= n;
      return c.score.score < n;
    case "Keyword searched":
      return c.events.some((e) => (e.payload ?? "").toLowerCase().includes(v));
    case "Consent":
      if (v === "subscribed") return latestEmail?.status === "granted";
      return (latestEmail?.status ?? "none").includes(v);
    case "Not suppressed":
      return !c.email || !ctx.suppressions.has(c.email);
    case "Engagement":
      return c.engagement === v;
    default:
      return false; // unknown field never silently matches
  }
}

async function evaluateHits(workspaceId: string, match: "all" | "any", rules: Rule[]) {
  const [contacts, suppressionRows] = await Promise.all([
    loadContacts(workspaceId),
    db.suppressionRecord.findMany({ where: { workspaceId } }),
  ]);
  const suppressions = new Set(suppressionRows.map((s) => s.email));

  const include = rules.filter((r) => !r.exclude);
  const exclude = rules.filter((r) => r.exclude);

  return contacts.filter((contact) => {
    if (contact.email && suppressions.has(contact.email)) return false;
    const ctx = { contact, suppressions };
    const inc = include.length === 0 || (match === "all" ? include.every((r) => matches(r, ctx)) : include.some((r) => matches(r, ctx)));
    const exc = exclude.some((r) => matches(r, ctx));
    return inc && !exc;
  });
}

// Full member id list — used by the send path, which re-checks consent and
// suppression itself at send time.
export async function evaluateSegmentMembers(workspaceId: string, match: "all" | "any", rules: Rule[]): Promise<string[]> {
  const hits = await evaluateHits(workspaceId, match, rules);
  return hits.map((c) => c.id);
}

export async function evaluateSegment(workspaceId: string, match: "all" | "any", rules: Rule[]) {
  const hits = await evaluateHits(workspaceId, match, rules);

  return {
    count: hits.length,
    revenue: hits.reduce((s, c) => s + c.revenue, 0),
    preview: hits.slice(0, 8).map((c) => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email,
      email: c.email ?? "(no email · phone lead)",
      score: c.score?.score ?? 0,
    })),
  };
}
