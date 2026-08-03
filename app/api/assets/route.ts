// Asset uploads: images for popups, brand logos and emails.
//
// Files land on the persistent disk (data/uploads — the same Render disk the
// database lives on) and are served publicly from /api/assets/<name>, because
// storefront popups and email clients must be able to load them without a
// session. Uploading requires a signed-in user; nothing here executes, only
// image types are accepted, and names are regenerated server-side so a
// filename can never traverse paths.
import { NextRequest } from "next/server";
import { mkdir, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/lib/server/permissions";
import { audit } from "@/lib/server/audit";

export const ASSET_DIR = process.env.ASSET_DIR ?? path.join(process.cwd(), "data", "uploads");

const TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "Attach a file field named 'file'." }, { status: 400 });

  const ext = TYPES[file.type];
  if (!ext) return Response.json({ ok: false, error: "Images only: PNG, JPEG, WebP, GIF or SVG." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "Maximum size is 5MB." }, { status: 400 });

  // Server-generated name: original names never touch the filesystem.
  const base = (file.name || "asset").replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40) || "asset";
  const name = `${Date.now().toString(36)}-${base}${ext}`;

  await mkdir(ASSET_DIR, { recursive: true });
  await writeFile(path.join(ASSET_DIR, name), Buffer.from(await file.arrayBuffer()));
  await audit(user.workspaceId, user.email, "asset.uploaded", `${name} · ${(file.size / 1024).toFixed(0)}KB`);

  return Response.json({ ok: true, name, url: `/api/assets/${name}` });
}

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  try {
    const names = (await readdir(ASSET_DIR)).filter((n) => !n.startsWith("."));
    const rows = await Promise.all(
      names.map(async (n) => {
        const s = await stat(path.join(ASSET_DIR, n));
        return { name: n, url: `/api/assets/${n}`, bytes: s.size, uploadedAt: s.mtime.toISOString() };
      })
    );
    rows.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return Response.json({ ok: true, assets: rows.slice(0, 100) });
  } catch {
    return Response.json({ ok: true, assets: [] });
  }
}
