// Boot-time seeder for deployed environments: seeds the demo workspace only
// when the database is empty, so redeploys never duplicate or wipe data.
import { execSync } from "node:child_process";
import { db } from "../lib/server/db";

async function main() {
  const workspaces = await db.workspace.count();
  if (workspaces > 0) {
    console.log(`Database already seeded (${workspaces} workspace).`);
    const ws = await db.workspace.findFirstOrThrow();
    // Login users are always refreshed from env.
    const { seedUsers } = await import("../prisma/seed-users");
    await seedUsers(ws.id);
    if (ws.name.includes("Vitalis")) {
      // Demo workspace: demo feature top-ups.
      const { seedIntake } = await import("../prisma/seed-intake");
      await seedIntake(ws.id);
      const { seedGrowth, seedStores } = await import("../prisma/seed-growth");
      await seedGrowth(ws.id);
      await seedStores(ws.id);
    } else {
      // Clean launch workspace: NEVER run demo top-ups (they would reintroduce
      // fake contacts and the simulated Savvy story). Launch top-up only.
      const { launchTopUp } = await import("../prisma/seed-clean");
      await launchTopUp(ws.id);
    }
    return;
  }
  const mode = process.env.SENDLOOM_DATA_MODE ?? "clean_launch";
  console.log(`Empty database detected. Seeding ${mode} workspace…`);
  execSync(mode === "demo" ? "npx tsx prisma/seed.ts" : "npx tsx prisma/seed-clean.ts", { stdio: "inherit" });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
