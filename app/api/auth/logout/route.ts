import { SESSION_COOKIE } from "@/lib/server/auth";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
