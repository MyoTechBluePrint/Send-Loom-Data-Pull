// Boot-time seeder for deployed environments: seeds the demo workspace only
// when the database is empty, so redeploys never duplicate or wipe data.
import { execSync } from "node:child_process";
import { db } from "../lib/server/db";

async function main() {
  const workspaces = await db.workspace.count();
  if (workspaces > 0) {
    console.log(`Database already seeded (${workspaces} workspace).`);
    // Feature top-ups for databases seeded before newer features shipped.
    const ws = await db.workspace.findFirstOrThrow();
    const { seedIntake } = await import("../prisma/seed-intake");
    await seedIntake(ws.id);
    const { seedUsers } = await import("../prisma/seed-users");
    await seedUsers(ws.id);
    const { seedGrowth } = await import("../prisma/seed-growth");
    await seedGrowth(ws.id);
    return;
  }
  console.log("Empty database detected. Seeding demo workspace…");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
