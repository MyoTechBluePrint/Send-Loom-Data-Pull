import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "./db";
import { audit } from "./audit";

export async function authenticateStore(req: NextRequest) {
  const key = req.headers.get("x-sendloom-key");
  if (!key) return null;
  return db.store.findUnique({ where: { apiKey: key } });
}

export function unauthorized() {
  return Response.json({ ok: false, error: "Invalid or missing x-sendloom-key" }, { status: 401 });
}

type Store = NonNullable<Awaited<ReturnType<typeof authenticateStore>>>;

// Authenticates the store AND, when the plugin sends x-sendloom-signature,
// verifies the HMAC of the raw body against the store key. Missing signature
// is allowed (older plugin versions); a present-but-wrong one is rejected.
export async function readSignedBody(req: NextRequest): Promise<{ store: Store; body: unknown } | Response> {
  const store = await authenticateStore(req);
  if (!store) return unauthorized();

  const raw = await req.text();
  const signature = req.headers.get("x-sendloom-signature");
  if (signature) {
    const expected = createHmac("sha256", store.apiKey).update(raw).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await audit(store.workspaceId, `plugin:${store.id}`, "api.signature_invalid", `Rejected ${req.nextUrl.pathname}`);
      return Response.json({ ok: false, error: "Invalid request signature" }, { status: 401 });
    }
  }

  try {
    return { store, body: raw ? JSON.parse(raw) : null };
  } catch {
    return { store, body: null };
  }
}
