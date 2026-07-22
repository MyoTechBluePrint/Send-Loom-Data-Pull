// Provision scoped API keys for the apps that consume Sendloom: the six
// managed white-label businesses (whitelabel-os) and the MV Social app.
// Idempotent: a consumer whose env variable already exists is skipped, so
// re-runs never orphan working keys. Secrets are written STRAIGHT into the
// consuming apps' gitignored env files and never printed; the console shows
// only variable names and the stored last-4 hint.
// Run: npx tsx scripts/provision-consumers.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { db } from "../lib/server/db";
import { createApiKey, type Permission } from "../lib/server/platform";

const WL_ENV = "/Users/stephenclark/Sites/whitelabel-os/.env.development";
const MV_ENV = "/Users/stephenclark/Sites/mv-social/.env.local";

const TENANTS = [
  ["morgan-trading-co", "Morgan Trading Co."],
  ["frenzi-trading", "Frenzi Trading"],
  ["marbella-trading-club", "Marbella Trading Club"],
  ["blake-trades", "Blake Trades"],
  ["brad-merchant-twf", "Brad Merchant TWF"],
  ["sgm-trading-autos", "SGM Trading Autos"],
] as const;

const PERMS: Permission[] = ["contacts:read", "contacts:write", "events:write"];

function hasVar(file: string, name: string) {
  return existsSync(file) && readFileSync(file, "utf8").split("\n").some((l) => l.startsWith(`${name}=`));
}
// Past bug: appending without checking the trailing newline glued two vars
// onto one line. Always normalise before appending.
function appendVar(file: string, name: string, value: string) {
  let s = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (s.length && !s.endsWith("\n")) s += "\n";
  writeFileSync(file, `${s}${name}=${value}\n`);
}

async function main() {
  const ws = await db.workspace.findFirstOrThrow({ where: { name: { contains: "Launch" } } });
  let minted = 0, skipped = 0;

  for (const [slug, label] of TENANTS) {
    const envVar = `SENDLOOM_KEY_${slug.toUpperCase().replace(/-/g, "_")}`;
    if (hasVar(WL_ENV, envVar)) { console.log(`  · ${envVar} already present, skipped`); skipped++; continue; }
    const integration = await db.integration.upsert({
      where: { workspaceId_slug: { workspaceId: ws.id, slug: `wl-${slug}` } },
      create: { workspaceId: ws.id, slug: `wl-${slug}`, name: `White label · ${label}`, kind: "crm", status: "connected", connectedAt: new Date() },
      update: {},
    });
    const key = await createApiKey({
      workspaceId: ws.id, integrationId: integration.id,
      name: `${label} growth connection`, permissions: PERMS,
    });
    appendVar(WL_ENV, envVar, key.secretKey);
    console.log(`  ✓ ${envVar} minted (…${key.secretKey.slice(-4)}) → integration wl-${slug}`);
    minted++;
  }

  // MV Social app: reuse the existing mvsocial integration.
  if (hasVar(MV_ENV, "SENDLOOM_KEY")) { console.log("  · MV Social SENDLOOM_KEY already present, skipped"); skipped++; }
  else {
    const mv = await db.integration.upsert({
      where: { workspaceId_slug: { workspaceId: ws.id, slug: "mvsocial" } },
      create: { workspaceId: ws.id, slug: "mvsocial", name: "MV Socials", kind: "social", status: "connected", connectedAt: new Date() },
      update: { status: "connected", connectedAt: new Date() },
    });
    const key = await createApiKey({
      workspaceId: ws.id, integrationId: mv.id,
      name: "MV Social app lead capture", permissions: ["contacts:write", "events:write"],
    });
    appendVar(MV_ENV, "SENDLOOM_URL", "http://localhost:3009");
    appendVar(MV_ENV, "SENDLOOM_KEY", key.secretKey);
    console.log(`  ✓ MV Social SENDLOOM_KEY minted (…${key.secretKey.slice(-4)})`);
    minted++;
  }

  console.log(`\n${minted} minted, ${skipped} skipped. Secrets live only in the gitignored env files.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
