// Boot hook (Next.js instrumentation contract: exported register() runs once
// per server instance, before it serves requests). This is what makes
// delivery self-driving: nothing external calls POST /api/billing/lifecycle
// on a schedule, so the server carries its own heartbeat. The route stays as
// a manual override and an external-cron seam; every job in the tick is
// guarded to happen once, so both running is harmless.
export async function register() {
  // Node runtime only: the tick opens Prisma, which the edge runtime cannot.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // register() also fires inside `next build` workers; a build must never
  // start touching the database on a timer.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // The off switch, for scripts and for running the tick from an external
  // cron only.
  if (process.env.LIFECYCLE_TICKER === "off") return;

  // Imported lazily so the edge bundle never pulls the Prisma-backed graph.
  const { startLifecycleTicker } = await import("./lib/server/lifecycle");
  startLifecycleTicker();
}
