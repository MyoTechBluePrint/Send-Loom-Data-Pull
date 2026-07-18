import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { authenticateStore, unauthorized } from "@/lib/server/apiAuth";

const Body = z.object({
  storeUrl: z.string().min(3),
  pluginVersion: z.string().optional(),
  wooVersion: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const store = await authenticateStore(req);
  if (!store) return unauthorized();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await db.store.update({
    where: { id: store.id },
    data: {
      status: "connected",
      url: parsed.data.storeUrl.replace(/^https?:\/\//, ""),
      pluginVersion: parsed.data.pluginVersion ?? store.pluginVersion,
      lastSyncAt: new Date(),
    },
  });

  await audit(store.workspaceId, `plugin:${store.id}`, "store.connected", `Plugin connected from ${parsed.data.storeUrl} (plugin ${parsed.data.pluginVersion ?? "?"}, Woo ${parsed.data.wooVersion ?? "?"})`);

  return Response.json({ ok: true, store: { id: updated.id, name: updated.name, workspaceId: updated.workspaceId } });
}
