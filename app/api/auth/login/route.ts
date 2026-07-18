import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { createSessionToken, verifyPassword, SESSION_COOKIE } from "@/lib/server/auth";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Enter an email and password." }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)) {
    // Same message either way: no account enumeration.
    return Response.json({ ok: false, error: "Email or password is incorrect." }, { status: 401 });
  }

  await audit(user.workspaceId, email, "auth.login", "Signed in to staging");

  const token = createSessionToken(email);
  const res = Response.json({ ok: true, name: user.name });
  res.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return res;
}
