import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

import { ROLE_LABELS, can } from "@/lib/server/permissions";

export async function GET(req: NextRequest) {
  const email = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!email) return Response.json({ ok: false }, { status: 401 });
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return Response.json({ ok: false }, { status: 401 });
  return Response.json({
    ok: true,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role] ?? user.role,
    canTriageFeedback: can(user.role, "triage_feedback"),
    canResetDemo: can(user.role, "reset_demo_data"),
    // The honest environment: "Live" only when real email can actually go
    // out. On production without provider keys the truthful label is that
    // sending is off, which is exactly what the banner should say.
    env:
      process.env.EMAIL_SENDING_ENABLED === "true" &&
      (process.env.RESEND_API_KEY || process.env.AWS_ACCESS_KEY_ID)
        ? "Live"
        : process.env.RENDER
          ? "No live email sending"
          : "Staging",
  });
}
