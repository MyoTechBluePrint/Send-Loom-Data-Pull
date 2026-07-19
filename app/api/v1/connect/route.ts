import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { readSignedBody } from "@/lib/server/apiAuth";
import { looksBackend, normalizeHost, splitDomains } from "@/lib/server/tracking-domains";

const Body = z.object({
  storeUrl: z.string().min(3),
  pluginVersion: z.string().optional(),
  wooVersion: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await readSignedBody(req);
  if (auth instanceof Response) return auth;
  const { store, body } = auth;

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  // Auto-learn the connecting site's host. Storefront-looking hosts join the
  // tracking allowlist; backend-looking hosts (api.*, admin.*) are recorded
  // as backend domains instead, so a headless WordPress on api.myotech.store
  // can never allowlist itself for customer tracking.
  const host = normalizeHost(parsed.data.storeUrl);
  const domains = splitDomains(store.domains);
  const backend = splitDomains(store.backendDomains);
  if (host && looksBackend(host)) {
    if (!backend.includes(host)) backend.push(host);
  } else if (host && !domains.includes(host)) {
    domains.push(host);
  }

  const updated = await db.store.update({
    where: { id: store.id },
    data: {
      status: "connected",
      // Keep url pointing at the STOREFRONT: only overwrite it with the
      // connecting host when that host is not a backend domain.
      url: host && !looksBackend(host) ? host : store.url,
      domains: domains.join(","),
      backendDomains: backend.join(",") || null,
      pluginVersion: parsed.data.pluginVersion ?? store.pluginVersion,
      lastSyncAt: new Date(),
    },
  });

  await audit(store.workspaceId, `plugin:${store.id}`, "store.connected", `Plugin connected from ${parsed.data.storeUrl} (plugin ${parsed.data.pluginVersion ?? "?"}, Woo ${parsed.data.wooVersion ?? "?"})`);

  return Response.json({ ok: true, store: { id: updated.id, publicId: updated.publicId, name: updated.name, environment: updated.environment, workspaceId: updated.workspaceId } });
}
