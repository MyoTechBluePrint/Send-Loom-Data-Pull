// Serve an uploaded asset. Public on purpose: popups on storefronts and
// images in emails cannot carry a session. Names are validated to a strict
// charset, so path traversal is structurally impossible.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ASSET_DIR } from "../route";

const CONTENT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[a-zA-Z0-9-_]+\.(png|jpg|webp|gif|svg)$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(path.join(ASSET_DIR, name));
    const ext = name.slice(name.lastIndexOf("."));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": CONTENT[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
