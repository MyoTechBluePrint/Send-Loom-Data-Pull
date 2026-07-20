import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { createSessionToken, verifyPassword, checkRateLimit, SESSION_COOKIE } from "@/lib/server/auth";

const Body = z.object({ email: z.string().email(), password: z.string().min(1), rememberMe: z.boolean().optional() });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Enter an email and password." }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit(`login:${ip}:${parsed.data.email.toLowerCase()}`)) {
    return Response.json({ ok: false, error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash || user.disabled || !verifyPassword(parsed.data.password, user.passwordHash)) {
    // Audit the attempted email (never the password) so failed sign-ins are
    // diagnosable from Admin → Audit log instead of guesswork.
    const ws = await db.workspace.findFirst();
    if (ws) {
      const ua = (req.headers.get("user-agent") ?? "unknown").slice(0, 120);
      await audit(ws.id, email, "auth.login_failed", `${!user ? "No account with this email" : "Wrong password"} · ip ${ip} · ${ua}`);
    }
    // Same message either way: no account enumeration.
    return Response.json({ ok: false, error: "Email or password is incorrect." }, { status: 401 });
  }

  await audit(user.workspaceId, email, "auth.login", "Signed in to staging");

  const days = parsed.data.rememberMe ? 30 : 7;
  const token = createSessionToken(email, Date.now(), days);
  const res = Response.json({ ok: true, name: user.name });
  res.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 24 * 3600}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return res;
}
