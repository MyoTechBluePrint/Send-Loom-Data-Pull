// Lead scoring engine. Rules live in code for now (per V3 brief); the shape is
// ready to become per-workspace settings later.
import { db } from "./db";

export type ScoreReason = { reason: string; points: number };

// Points per event type. Applied per occurrence, capped per type below.
const EVENT_POINTS: Record<string, { points: number; label: string; cap?: number }> = {
  email_open: { points: 5, label: "Opened email", cap: 15 },
  email_click: { points: 10, label: "Clicked email", cap: 30 },
  product_viewed: { points: 15, label: "Viewed product", cap: 30 },
  view: { points: 15, label: "Viewed product", cap: 30 },
  search: { points: 20, label: "Searched high-intent keyword", cap: 40 },
  guide_downloaded: { points: 25, label: "Downloaded guide" },
  form_submitted: { points: 40, label: "Submitted form" },
  quiz_completed: { points: 25, label: "Completed quiz" },
  cart_add: { points: 30, label: "Added to cart", cap: 30 },
  cart: { points: 30, label: "Added to cart", cap: 30 },
  checkout_started: { points: 35, label: "Started checkout", cap: 35 },
  checkout: { points: 35, label: "Started checkout", cap: 35 },
  consultation_requested: { points: 40, label: "Requested consultation" },
  consultation_booked: { points: 50, label: "Booked consultation" },
};

const INACTIVITY_DAYS = 90;
const INACTIVITY_PENALTY = -20;

export async function recomputeLeadScore(contactId: string): Promise<{ score: number; status: string; reasons: ScoreReason[] }> {
  const contact = await db.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: { events: { orderBy: { occurredAt: "desc" }, take: 500 } },
  });

  const reasons: ScoreReason[] = [];
  let score = 0;

  // Suppression / withdrawn email consent zeroes the score.
  const latestEmailConsent = await db.consentRecord.findFirst({
    where: { contactId, channel: "email" },
    orderBy: { createdAt: "desc" },
  });
  const suppressed = await db.suppressionRecord.findFirst({
    where: { workspaceId: contact.workspaceId, email: contact.email },
  });
  if (suppressed || latestEmailConsent?.status === "withdrawn" || latestEmailConsent?.status === "suppressed") {
    const reason = suppressed?.reason === "hard_bounce" ? { reason: "Hard bounce", points: -40 } : { reason: "Unsubscribed", points: -100 };
    const result = { score: 0, status: "suppressed", reasons: [reason] };
    await persist(contactId, result);
    return result;
  }

  // Purchases from rollups.
  if (contact.ordersCount >= 2) {
    score += 80;
    reasons.push({ reason: `Repeat purchase (${contact.ordersCount} orders)`, points: 80 });
  } else if (contact.ordersCount === 1) {
    score += 60;
    reasons.push({ reason: "Purchased once", points: 60 });
  }

  // Behavioural events, capped per type.
  const perType: Record<string, { total: number; count: number }> = {};
  for (const e of contact.events) {
    const rule = EVENT_POINTS[e.type];
    if (!rule) continue;
    const bucket = (perType[rule.label] ??= { total: 0, count: 0 });
    const capped = rule.cap ? Math.min(rule.points, Math.max(0, rule.cap - bucket.total)) : rule.points;
    bucket.total += capped;
    bucket.count += 1;
  }
  for (const [label, { total, count }] of Object.entries(perType)) {
    if (total <= 0) continue;
    score += total;
    reasons.push({ reason: count > 1 ? `${label} ×${count}` : label, points: total });
  }

  // Inactivity penalty.
  const last = contact.lastActivityAt ?? contact.createdAt;
  const daysIdle = (Date.now() - last.getTime()) / (24 * 3600 * 1000);
  if (daysIdle > INACTIVITY_DAYS) {
    score += INACTIVITY_PENALTY;
    reasons.push({ reason: `Inactive ${Math.round(daysIdle)} days`, points: INACTIVITY_PENALTY });
  }

  score = Math.max(0, Math.min(100, score));

  let status: string;
  if (contact.revenue > 500 && contact.ordersCount >= 3) status = "vip";
  else if (contact.ordersCount > 0) status = "customer";
  else if (score >= 60) status = "ready";
  else if (score >= 45) status = "hot";
  else if (score >= 25) status = "warm";
  else status = "cold";

  const result = { score, status, reasons };
  await persist(contactId, result);
  return result;
}

async function persist(contactId: string, r: { score: number; status: string; reasons: ScoreReason[] }) {
  await db.leadScore.upsert({
    where: { contactId },
    create: { contactId, score: r.score, status: r.status, reasons: JSON.stringify(r.reasons) },
    update: { score: r.score, status: r.status, reasons: JSON.stringify(r.reasons), calculatedAt: new Date() },
  });
}
