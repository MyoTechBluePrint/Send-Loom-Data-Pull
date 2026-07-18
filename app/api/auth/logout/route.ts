import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  const email = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (email) {
    const ws = await db.workspace.findFirst();
    if (ws) await audit(ws.id, email, "auth.logout", "Signed out");
  }
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
