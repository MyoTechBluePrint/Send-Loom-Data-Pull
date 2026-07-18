// Provisions login users from SEED_USERS="email:pass,email:pass". Runs at
// seed time and as a boot top-up. Passwords never live in the repo; only
// scrypt hashes reach the database. Re-running refreshes hashes, so rotating
// a password is: change the env var, restart.
import { db } from "../lib/server/db";
import { hashPassword } from "../lib/server/auth";

export async function seedUsers(workspaceId: string) {
  const raw = process.env.SEED_USERS;
  if (!raw) {
    console.log("SEED_USERS not set — no login users provisioned.");
    return 0;
  }
  let count = 0;
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf(":");
    if (idx < 1) continue;
    const email = pair.slice(0, idx).trim().toLowerCase();
    const password = pair.slice(idx + 1).trim();
    if (!email || !password) continue;
    const name =
      email === "talk@willwoolley.co.uk"
        ? "Will Woolley"
        : email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    await db.user.upsert({
      where: { email },
      create: {
        workspaceId, email, name,
        role: email.startsWith("steve") ? "owner" : "viewer",
        passwordHash: hashPassword(password),
      },
      update: { passwordHash: hashPassword(password) },
    });
    count++;
  }
  console.log(`Provisioned ${count} login user(s) from SEED_USERS.`);
  return count;
}
