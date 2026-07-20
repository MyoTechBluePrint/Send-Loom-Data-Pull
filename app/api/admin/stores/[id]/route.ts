// Owner-only store configuration: tracking mode, storefront URL and domain
// lists. Guardrails: a storefront URL or allowed tracking domain that looks
// like a backend/API address (api., admin., staging., localhost…) is refused
// unless override=true is sent explicitly; overrides are audited loudly.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { can, currentUser } from "@/lib/server/permissions";
import { looksBackend, normalizeHost, splitDomains } from "@/lib/server/tracking-domains";

const Body = z.object({
  trackingMode: z.enum(["live", "test"]).optional(),
  url: z.string().min(3).max(200).optional(),
  domains: z.string().max(500).optional(),          // comma list of allowed tracking domains
  backendDomains: z.string().max(500).optional(),   // comma list, rejected for tracking
  override: z.boolean().optional(),                 // explicit consent for suspicious values
});

const SUSPICIOUS = "This appears to be an API, admin, development or backend address. Enter the public website domain customers use to browse products and complete checkout, or resend with override enabled.";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !can(user.role, "manage_users")) {
    return Response.json({ ok: false, error: "Owner access required." }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid store settings payload." }, { status: 400 });
  const { trackingMode, url, domains, backendDomains, override } = parsed.data;
  if (trackingMode === undefined && url === undefined && domains === undefined && backendDomains === undefined) {
    return Response.json({ ok: false, error: "Nothing to change." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const store = await db.store.findUnique({ where: { id } });
  if (!store) return Response.json({ ok: false, error: "Store not found" }, { status: 404 });

  const changes: string[] = [];
  const data: Record<string, unknown> = {};

  if (trackingMode !== undefined && trackingMode !== store.trackingMode) {
    data.trackingMode = trackingMode;
    changes.push(`tracking mode → ${trackingMode.toUpperCase()}`);
  }

  if (url !== undefined) {
    const host = normalizeHost(url);
    if (!host || host.includes("localhost")) return Response.json({ ok: false, error: "Enter a real public domain." }, { status: 400 });
    if (looksBackend(host) && !override) return Response.json({ ok: false, error: SUSPICIOUS, needsOverride: true }, { status: 400 });
    data.url = host;
    changes.push(`storefront → ${host}${looksBackend(host) ? " (OVERRIDE: backend-looking domain accepted on explicit instruction)" : ""}`);
  }

  if (domains !== undefined) {
    const list = splitDomains(domains);
    if (list.length === 0) return Response.json({ ok: false, error: "At least one allowed tracking domain is required." }, { status: 400 });
    const suspicious = list.filter((d) => looksBackend(d) || d.includes("localhost"));
    if (suspicious.length > 0 && !override) {
      return Response.json({ ok: false, error: `${SUSPICIOUS} Suspicious: ${suspicious.join(", ")}`, needsOverride: true }, { status: 400 });
    }
    data.domains = list.join(",");
    changes.push(`allowed tracking domains → ${list.join(", ")}${suspicious.length ? ` (OVERRIDE for: ${suspicious.join(", ")})` : ""}`);
  }

  if (backendDomains !== undefined) {
    const list = splitDomains(backendDomains);
    data.backendDomains = list.join(",") || null;
    changes.push(`backend domains → ${list.join(", ") || "none"}`);
  }

  const updated = await db.store.update({ where: { id }, data });
  await audit(store.workspaceId, user.email, "store.settings", `${store.name}: ${changes.join(" · ")}`);

  return Response.json({
    ok: true,
    store: { id: updated.id, url: updated.url, domains: updated.domains, backendDomains: updated.backendDomains, trackingMode: updated.trackingMode },
  });
}
