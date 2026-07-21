// Test-session utility (Part 1B): mints a short-lived authenticated session
// for automated tooling WITHOUT a browser login form.
//
// Safety model:
// - 404 in production unless SENDLOOM_ALLOW_TEST_AUTH=preview-approved.
// - Requires SENDLOOM_TEST_AUTH_SECRET to be configured server-side AND
//   presented by the caller (timing-safe compare). No secret, no route.
// - Only signs in reserved @sendloom.local accounts, never real users.
// - Sessions last 6 hours, every mint is rate-limited and audited.
// - The response never echoes the secret; the cookie is the only output.
import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { checkRateLimit, createSessionToken, SESSION_COOKIE } from "@/lib/server/auth";
import { DEV_ACCOUNT_DOMAIN, devAccessAllowed, seedDevAccounts } from "@/lib/server/dev-access";

const Body = z.object({ email: z.string().email().optional() });

function secretMatches(presented: string | null): boolean {
  const expected = process.env.SENDLOOM_TEST_AUTH_SECRET;
  if (!expected || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // Indistinguishable from a missing route when disallowed or misconfigured.
  if (!devAccessAllowed()) return new Response(null, { status: 404 });
  if (!secretMatches(req.headers.get("x-sendloom-test-secret"))) return new Response(null, { status: 404 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit(`test-session:${ip}`, 20)) {
    return Response.json({ ok: false, error: "rate limited" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const email = (parsed.success && parsed.data.email ? parsed.data.email : "developer@sendloom.local").toLowerCase();
  if (!email.endsWith(DEV_ACCOUNT_DOMAIN)) {
    return Response.json({ ok: false, error: "test sessions are for @sendloom.local accounts only" }, { status: 403 });
  }

  const ws = await db.workspace.findFirst();
  if (!ws) return Response.json({ ok: false, error: "no workspace" }, { status: 500 });
  await seedDevAccounts(ws.id);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return Response.json({ ok: false, error: "unknown dev account (set SENDLOOM_DEV_PASSWORD)" }, { status: 403 });

  await audit(ws.id, email, "auth.test_session", `Minted 6h test session · ip ${ip}`);
  const token = createSessionToken(email, Date.now(), 0.25); // 6 hours
  const res = Response.json({ ok: true, email });
  res.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${6 * 3600}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return res;
}
