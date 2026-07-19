import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { readSignedBody } from "@/lib/server/apiAuth";

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

  // Auto-allowlist the connecting site's host so the browser tracker is
  // accepted even when the real domain differs from what was seeded
  // (www variants, different TLD, staging subdomain).
  const host = parsed.data.storeUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  const domains = (store.domains ?? "").split(",").map((d) => d.trim().replace(/^www\./, "")).filter(Boolean);
  if (host && !domains.includes(host)) domains.push(host);

  const updated = await db.store.update({
    where: { id: store.id },
    data: {
      status: "connected",
      url: parsed.data.storeUrl.replace(/^https?:\/\//, ""),
      domains: domains.join(","),
      pluginVersion: parsed.data.pluginVersion ?? store.pluginVersion,
      lastSyncAt: new Date(),
    },
  });

  await audit(store.workspaceId, `plugin:${store.id}`, "store.connected", `Plugin connected from ${parsed.data.storeUrl} (plugin ${parsed.data.pluginVersion ?? "?"}, Woo ${parsed.data.wooVersion ?? "?"})`);

  return Response.json({ ok: true, store: { id: updated.id, publicId: updated.publicId, name: updated.name, environment: updated.environment, workspaceId: updated.workspaceId } });
}
