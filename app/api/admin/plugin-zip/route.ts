// Owner-only download of the built WordPress plugin ZIP, so the install
// never depends on file transfer outside Sendloom. The ZIP is committed at
// plugin-builds/ and therefore present on the deployed filesystem.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { can, currentUser } from "@/lib/server/permissions";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || !can(user.role, "download_plugin")) {
    return Response.json({ ok: false, error: "Owner or admin access required." }, { status: 403 });
  }

  const zipPath = path.join(process.cwd(), "plugin-builds", "sendloom-woocommerce.zip");
  let buf: Buffer;
  try {
    buf = await readFile(zipPath);
  } catch {
    return Response.json({ ok: false, error: "Plugin ZIP not found on this deployment. Run npm run plugin:zip and redeploy." }, { status: 404 });
  }

  const ws = await db.workspace.findFirst();
  if (ws) await audit(ws.id, user.email, "plugin.zip_downloaded", "WordPress plugin ZIP downloaded from Store Tracking");

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="sendloom-woocommerce.zip"',
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
