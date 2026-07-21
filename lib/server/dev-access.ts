// Development and test access. The rules, in one place:
//
// - NEVER active in production. Every entry point checks devAccessAllowed(),
//   which is false when NODE_ENV === "production" unless the operator sets
//   SENDLOOM_ALLOW_TEST_AUTH=preview-approved (for protected preview envs).
// - Dev accounts live only where SENDLOOM_DEV_PASSWORD is configured; the
//   password never appears in the repo, only in local/preview env files.
// - Accounts use the reserved @sendloom.local domain so they can never be
//   confused with (or collide with) real people.
import { db } from "./db";
import { hashPassword } from "./auth";

export function devAccessAllowed(): boolean {
  if (process.env.NODE_ENV === "production") {
    return process.env.SENDLOOM_ALLOW_TEST_AUTH === "preview-approved";
  }
  return true;
}

export const DEV_ACCOUNT_DOMAIN = "@sendloom.local";

// One account per role so role-specific behaviour is testable (Part D).
export const DEV_ACCOUNTS = [
  { email: "developer@sendloom.local", name: "Developer (dev only)", role: "owner" },
  { email: "dev.admin@sendloom.local", name: "Dev Admin (dev only)", role: "full_access" },
  { email: "dev.marketing@sendloom.local", name: "Dev Marketing (dev only)", role: "ads_operator" },
  { email: "dev.viewer@sendloom.local", name: "Dev Viewer (dev only)", role: "viewer" },
];

// Seed/refresh the dev accounts. No-op without the env password or outside
// allowed environments. Called from seed + boot top-up, and lazily from the
// login route so a fresh local database heals itself on first sign-in.
export async function seedDevAccounts(workspaceId: string): Promise<number> {
  const password = process.env.SENDLOOM_DEV_PASSWORD;
  if (!devAccessAllowed() || !password) return 0;
  for (const a of DEV_ACCOUNTS) {
    await db.user.upsert({
      where: { email: a.email },
      create: { workspaceId, email: a.email, name: a.name, role: a.role, passwordHash: hashPassword(password) },
      update: { passwordHash: hashPassword(password), role: a.role, disabled: false },
    });
  }
  return DEV_ACCOUNTS.length;
}
