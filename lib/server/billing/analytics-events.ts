// Commercial funnel events.
//
// These ride the platform's existing Event model rather than a second system.
// They are written on the `internal` stream, which customer analytics already
// excludes by design, so recording SendLoom's own funnel can never contaminate
// a customer's storefront numbers.
//
// They bypass eventIngestionService deliberately: that pipeline exists to
// classify untrusted storefront traffic against a tracking allowlist, and these
// are first-party server facts with no origin to validate.

import { db } from "@/lib/server/db";

export type FunnelEvent =
  | "signup_started"
  | "signup_completed"
  | "trial_started"
  | "onboarding_completed"
  | "website_connected"
  | "campaign_created"
  | "first_send_completed"
  | "plan_viewed"
  | "plan_selected"
  | "payment_method_setup_started"
  | "payment_method_verified"
  | "trial_converted"
  | "first_payment_succeeded"
  | "first_payment_failed"
  | "subscription_cancelled";

export const FUNNEL_EVENTS: FunnelEvent[] = [
  "signup_started", "signup_completed", "trial_started", "onboarding_completed",
  "website_connected", "campaign_created", "first_send_completed",
  "plan_viewed", "plan_selected", "payment_method_setup_started",
  "payment_method_verified", "trial_converted", "first_payment_succeeded",
  "first_payment_failed", "subscription_cancelled",
];

/**
 * Funnel events that happen before an account exists are attributed here.
 * Event.workspaceId carries no foreign key, and every workspace-scoped query
 * filters on a real id, so these rows are inert everywhere else.
 */
export const ANONYMOUS_WORKSPACE = "__anonymous__";

/**
 * Record a funnel event.
 *
 * `once` makes the event idempotent for milestones that are, by definition,
 * first-time-only: first send, trial converted, onboarding completed. Without
 * it a repeated action would inflate the funnel.
 */
export async function trackFunnel(
  event: FunnelEvent,
  opts: {
    workspaceId?: string;
    email?: string;
    payload?: Record<string, unknown>;
    once?: boolean;
    occurredAt?: Date;
  } = {}
): Promise<{ recorded: boolean }> {
  const workspaceId = opts.workspaceId ?? ANONYMOUS_WORKSPACE;

  if (opts.once) {
    const seen = await db.event.findFirst({
      where: { workspaceId, type: event, stream: "internal" },
      select: { id: true },
    });
    if (seen) return { recorded: false };
  }

  await db.event.create({
    data: {
      workspaceId,
      type: event,
      stream: "internal",
      sourceContext: "system",
      acceptReason: "First-party commercial funnel event",
      payload: opts.payload || opts.email ? JSON.stringify({ ...opts.payload, email: opts.email }) : null,
      occurredAt: opts.occurredAt ?? new Date(),
    },
  });

  return { recorded: true };
}

/** Funnel counts for the admin dashboard. Internal stream only. */
export async function funnelCounts(workspaceIds?: string[]) {
  const rows = await db.event.groupBy({
    by: ["type"],
    where: {
      stream: "internal",
      type: { in: FUNNEL_EVENTS },
      ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}),
    },
    _count: { _all: true },
  });

  // Distinct workspaces per event matters more than raw volume: five plan
  // views from one account is one account looking at plans.
  const distinct = await db.event.findMany({
    where: {
      stream: "internal",
      type: { in: FUNNEL_EVENTS },
      ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}),
    },
    select: { type: true, workspaceId: true },
    distinct: ["type", "workspaceId"],
  });

  const accounts: Record<string, number> = {};
  for (const d of distinct) accounts[d.type] = (accounts[d.type] ?? 0) + 1;

  const volume: Record<string, number> = {};
  for (const r of rows) volume[r.type] = r._count._all;

  return { accounts, volume };
}
