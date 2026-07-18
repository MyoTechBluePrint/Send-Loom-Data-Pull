// Staging auth: scrypt password hashes + stateless HMAC session cookies.
// Deliberately simple (no reset flow, no rate limiting) — a staging gate, not
// production auth. The token format is verifiable in the edge proxy via
// Web Crypto: base64url(email).expiryEpoch.hmacSha256(secret, email.expiry).
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "sendloom_session";
const WEEK = 7 * 24 * 3600;

function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-secret-not-for-prod";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createSessionToken(email: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + WEEK;
  const payload = `${Buffer.from(email).toString("base64url")}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

// In-memory rate limiter (per-process; a real deployment moves this to Redis).
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, max = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [emailB64, expStr, sig] = token.split(".");
  if (!emailB64 || !expStr || !sig) return null;
  const payload = `${emailB64}.${expStr}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (parseInt(expStr, 10) < Math.floor(Date.now() / 1000)) return null;
  return Buffer.from(emailB64, "base64url").toString();
}

