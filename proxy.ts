// Staging auth gate. Every page and internal API requires a valid session
// cookie. Open: /login, /signup, /pricing, /api/auth/*, /api/health,
// /api/billing/webhook (signed by the payment provider, never by a session)
// and /api/v1/* (the store API authenticates with its own per-store key).
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "sendloom_session";
// /api/t = email open/click tracking, fetched by mail clients with no session.
const OPEN_PREFIXES = [
  "/login", "/signup", "/pricing", "/home",
  "/api/auth", "/api/health", "/api/v1", "/api/t", "/t/", "/r/",
  "/api/billing/webhook", "/api/billing/plans",
  "/api/t/delivery", // provider webhooks authenticate by signature, not session
  "/api/assets", // serving is public (emails/storefronts); uploads check the session in-handler
];

async function verifyToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [emailB64, expStr, sig] = token.split(".");
  if (!emailB64 || !expStr || !sig) return false;
  if (parseInt(expStr, 10) < Math.floor(Date.now() / 1000)) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${emailB64}.${expStr}`));
  const expected = Buffer.from(mac).toString("base64url");
  return sig === expected;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (OPEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET ?? "dev-secret-not-for-prod";
  const ok = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  // A logged-out visitor to the root gets the marketing homepage; deep links
  // still go to sign-in with a return path.
  if (pathname === "/") return NextResponse.redirect(new URL("/home", request.url));
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip static assets entirely.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|css|js)$).*)"],
};
