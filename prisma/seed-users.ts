// Provisions login users from SEED_USERS="email:pass,email:pass". Runs at
// seed time and as a boot top-up. Passwords never live in the repo; only
// scrypt hashes reach the database. Re-running refreshes hashes, so rotating
// a password is: change the env var, restart.
import { db } from "../lib/server/db";
import { hashPassword } from "../lib/server/auth";
import { seedDevAccounts } from "../lib/server/dev-access";

export async function seedUsers(workspaceId: string) {
  let raw = process.env.SEED_USERS;
  // Alternative single-worker provisioning per the staging brief.
  if (!raw && process.env.WORKER_DEMO_EMAIL && process.env.WORKER_DEMO_PASSWORD) {
    raw = `${process.env.WORKER_DEMO_EMAIL}:${process.env.WORKER_DEMO_PASSWORD}`;
  }
  if (!raw) {
    console.log("SEED_USERS not set — no login users provisioned.");
    return 0;
  }
  let count = 0;
  // Steve's real address logs in with the same password as the workspace
  // owner entry, so SEED_USERS doesn't need editing in Render.
  const pairs = raw.split(",");
  const ownerPair = pairs.find((p) => p.startsWith("steve@vitaliswellness.co.uk:"));
  if (ownerPair && !pairs.some((p) => p.startsWith("steve@frenziapp.com:"))) {
    pairs.push(`steve@frenziapp.com:${ownerPair.slice(ownerPair.indexOf(":") + 1)}`);
  }
  for (const pair of pairs) {
    const idx = pair.indexOf(":");
    if (idx < 1) continue;
    const email = pair.slice(0, idx).trim().toLowerCase();
    const password = pair.slice(idx + 1).trim();
    if (!email || !password) continue;
    const name =
      email === "talk@willwoolley.co.uk"
        ? "Will Woolley"
        : email.startsWith("steve@")
          ? "Steve Clark"
          : email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const role = email.startsWith("steve") ? "owner"
      : email === "talk@willwoolley.co.uk" || email === "hello@piotr.cx" ? "full_access"
      : email.startsWith("ads@") ? "ads_operator" : "viewer";
    await db.user.upsert({
      where: { email },
      create: { workspaceId, email, name, role, passwordHash: hashPassword(password) },
      update: { passwordHash: hashPassword(password), role },
    });
    count++;
  }
  console.log(`Provisioned ${count} login user(s) from SEED_USERS.`);
  const dev = await seedDevAccounts(workspaceId);
  if (dev) console.log(`Provisioned ${dev} dev account(s) (non-production only).`);
  return count;
}
