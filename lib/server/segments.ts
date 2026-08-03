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
    case "Country": {
      // The builder's multi-select stores a comma list ("Spain, France").
      // Any listed country matches; single free-text keeps includes() behaviour.
      const wanted = v.split(",").map((x) => x.trim()).filter(Boolean);
      const country = (c.country ?? "").toLowerCase();
      return wanted.some((w) => country === w || country.includes(w));
    }
    case "Tag":
      return c.tags.some((t) => t.tag.name.toLowerCase().includes(v));
    case "Property": {
      // Contact properties set by forms, surveys and polls: value is
      // "key=value" (equals) or "key" (exists). This is how an answer stored
      // as a property feeds a dynamic audience.
      try {
        const custom = c.customFields ? (JSON.parse(c.customFields) as Record<string, unknown>) : {};
        const [key, expected] = rule.value.split("=").map((s) => s.trim());
        if (!key) return false;
        const actual = String(custom[key] ?? "").toLowerCase();
        return expected === undefined ? actual !== "" : actual === expected.toLowerCase();
      } catch {
        return false;
      }
    }
    case "Source": {
      // Friendly names from the builder dropdown map to how sources are
      // actually recorded (sourceType or source text). "=x" means exact
      // sourceType — plain "checkout" would also hit future abandoned events.
      const SOURCE_ALIASES: Record<string, string[]> = {
        "whatsapp": ["whatsapp"],
        "email sign up": ["popup", "form", "signup", "subscribe", "embedded"],
        "purchase": ["checkout_completed", "woocommerce", "purchase", "order", "=checkout"],
        "abandoned checkout": ["checkout_abandoned", "cart_abandoned", "abandon", "recovery"],
        "facebook lead": ["facebook"],
        "instagram": ["instagram"],
        "tiktok": ["tiktok"],
        "csv import": ["import"],
        "api / integration": ["api", "integration"],
        "zapier": ["zapier"],
        "manual": ["manual"],
      };
      const wanted = v.split(",").map((x) => x.trim()).filter(Boolean);
      const hit = (s: (typeof c.sources)[number], tok: string) =>
        tok.startsWith("=")
          ? s.sourceType.toLowerCase() === tok.slice(1)
          : s.source.toLowerCase().includes(tok) || s.sourceType.toLowerCase().includes(tok);
      return wanted.some((w) => (SOURCE_ALIASES[w] ?? [w]).some((tok) => c.sources.some((s) => hit(s, tok))));
    }
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
