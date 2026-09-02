// The platform tick: every piece of time-driven work, run in one place.
//
// Billing transitions, gradual campaign batches, delayed automation steps,
// the winback sweep and the failed-send retry all advance here. The tick has
// two callers with one contract: POST /api/billing/lifecycle (an external
// cron or the run button in admin) and the in-process ticker registered by
// instrumentation.ts at boot. Every job inside is guarded to happen at most
// once per due item, so overlapping callers waste work but never repeat it.

import { advanceAll } from "@/lib/server/billing/lifecycle";
import { runDueBatches } from "@/lib/server/smart-send";
import { advanceDueRuns, retryFailedSends, sweepWinback } from "@/lib/server/automations";
import { runDueJourneys } from "@/lib/server/intelligence";

export type LifecycleTickSummary = {
  changed: number;
  actions: Awaited<ReturnType<typeof advanceAll>>;
  smartSendBatches: { campaignId: string; result: string }[];
  automationRuns: number;
  winbackEnrolled: number;
  retriedSends: number;
  /** Journey steps executed: the delayed half of the Comms OS sequences. */
  journeySteps: number;
};

/** One tick. Extracted from the route so the ticker can run it without a request. */
export async function runLifecycleTick(opts: { origin?: string } = {}): Promise<LifecycleTickSummary> {
  // Absolute links in lifecycle emails need an origin. The route passes the
  // request's own; the ticker has no request. Same fallback chain as
  // email-render.ts: Render's own external URL stands behind APP_ORIGIN so a
  // production tick can never write localhost into a real email.
  const origin =
    opts.origin ??
    process.env.APP_ORIGIN ??
    process.env.RENDER_EXTERNAL_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`;

  const actions = await advanceAll({ origin });
  // The same tick drives smart-send batches: one cron seam for the platform.
  const batches = await runDueBatches();
  const automationRuns = await advanceDueRuns();
  const winbackEnrolled = await sweepWinback();
  const retriedSends = await retryFailedSends();
  // Journeys were the one time-driven thing not on this tick: a delayed step
  // only advanced when an unrelated storefront event wandered in, so a two
  // day wait could stretch indefinitely on a quiet site. Now it is a job like
  // any other, and processDueJourneySteps only touches enrolments that are
  // actually due, so running it every minute is cheap.
  const journeySteps = await runDueJourneys();

  return {
    changed: actions.length,
    actions,
    smartSendBatches: batches,
    automationRuns,
    winbackEnrolled,
    retriedSends,
    journeySteps,
  };
}

// The interval handle lives on globalThis for the same reason the Prisma
// client does in db.ts: dev hot reload re-evaluates modules, and a fresh
// module instance must find the existing timer rather than start a second.
const globalForTicker = globalThis as unknown as { sendloomLifecycleTicker?: ReturnType<typeof setInterval> };

// In-process overlap guard. A tick that outlives the interval (a slow
// database, hundreds of due automation runs) must not have the next beat
// stack a second tick on top of it; the next beat simply skips.
let tickInFlight = false;

/**
 * Start the self-driving heartbeat. Called once per server boot from
 * instrumentation.ts; calling again is a no-op.
 */
export function startLifecycleTicker(intervalMs = 60_000) {
  if (globalForTicker.sendloomLifecycleTicker) return;

  const timer = setInterval(() => {
    if (tickInFlight) return;
    tickInFlight = true;
    runLifecycleTick()
      // The ticker must survive any single bad tick: log and beat again.
      .catch((error) => console.error("[sendloom] lifecycle tick failed", error))
      .finally(() => {
        tickInFlight = false;
      });
  }, intervalMs);
  // Never hold the process open on shutdown; the tick is best-effort by design.
  timer.unref?.();

  globalForTicker.sendloomLifecycleTicker = timer;
  console.log(`[sendloom] lifecycle ticker armed · every ${Math.round(intervalMs / 1000)}s`);
}
