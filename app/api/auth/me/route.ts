import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", admin: "Admin", marketing: "Marketing Manager",
  editor: "Content Editor", viewer: "Worker Admin",
};

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
    env: "Staging",
  });
}
