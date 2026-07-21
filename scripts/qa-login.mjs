// Local-only QA login for Claude's browser verification.
//
// Creates (or refreshes) a viewer-with-owner-pages account in the LOCAL dev
// database and writes its credentials to .qa-login (gitignored). Refuses to
// run against anything that isn't the local SQLite dev file, so this account
// can never exist in staging or production. Real user passwords are never
// involved.
//
//   node scripts/qa-login.mjs
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const envFile = (() => {
  try { return readFileSync(new URL("../.env", import.meta.url), "utf8"); } catch { return ""; }
})();
const dbUrl = process.env.DATABASE_URL ?? (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "");
if (!/file:.*dev\.db/.test(dbUrl)) {
  console.error("Refusing: DATABASE_URL is not the local dev.db. This script is local-only.");
  process.exit(1);
}

const db = new PrismaClient();
const email = "qa.claude@sendloom.local";
const password = randomBytes(9).toString("base64url");
const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

const ws = await db.workspace.findFirst();
if (!ws) {
  console.error("No workspace in local DB. Run the seed first.");
  process.exit(1);
}

const existing = await db.user.findFirst({ where: { email } });
if (existing) {
  await db.user.update({ where: { id: existing.id }, data: { passwordHash } });
} else {
  await db.user.create({
    data: { workspaceId: ws.id, email, name: "Claude QA (local only)", role: "owner", passwordHash },
  });
}

writeFileSync(new URL("../.qa-login", import.meta.url), `${email}\n${password}\n`);
console.log(`QA login refreshed for ${email}; credentials in .qa-login (gitignored).`);
await db.$disconnect();
