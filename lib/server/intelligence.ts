// The Communications OS intelligence layer. Business platforms (NITO first;
// Savvy Mango, HOMIKASA, Land Ledger, Frenzi, MyoTech next) post structured
// events here. Sendloom owns the Customer Intelligence Profile: identity,
// tags, per-platform attributes, lifecycle stage, timeline, score, and the
// journey engine that decides who is contacted, when, on which channel, with
// what content, and why. Consent arrives with the event and is recorded
// before any channel is used; unconfigured channels report honestly.
import { db } from "./db";
import { audit } from "./audit";
import { recomputeLeadScore } from "./scoring";
import { activeProvider } from "./sending";

export type IntelligenceEvent = {
  eventType: string; // e.g. wealth.application_submitted
  platform: string; // producing platform slug
  person: { email: string; name?: string; phone?: string; country?: string };
  consent?: { channel: string; basis: string; evidence?: string };
  tags?: string[]; // namespaced by the producer, e.g. "nito:wealth-band-100-250"
  attributes?: Record<string, unknown>; // merged into the intelligence profile
  data?: Record<string, unknown>; // journey context: refCode, checklist, slot…
  occurredAt?: string;
};

const EVENT_TITLES: Record<string, string> = {
  "wealth.application_submitted": "Private Wealth application submitted",
  "wealth.consultation_booked": "Discovery Call requested",
  "wealth.status_changed": "Private Wealth status changed",
  "brokerage.application_submitted": "Brokerage application submitted",
  "brokerage.blueprint_saved": "Brokerage Blueprint saved",
  "brokerage.design_call_booked": "Design Session requested",
  "copy.follower_enrolled": "Copy Trading follower enrolled",
};

export function knownIntelligenceEvent(type: string): boolean {
  return Boolean(EVENT_TITLES[type]) || /^[a-z-]+\.[a-z_]+$/.test(type);
}

// ---- Journey seeds ---------------------------------------------------------
// The two flagship sequences. Email steps send for real when the provider is
// armed; sms/whatsapp/push record honest simulated entries until their
// providers are configured. Meeting steps schedule relative to the booked
// slot, not the enrolment.
const SEED_JOURNEYS: { key: string; name: string; platform: string; trigger: string; steps: unknown[] }[] = [
  {
    key: "private-wealth-intake", name: "Private Wealth · intake", platform: "nito", trigger: "wealth.application_submitted",
    steps: [
      { offsetHours: 0, channel: "email", kind: "application_received", title: "Application received + personalised document checklist" },
      { offsetHours: 48, channel: "sms", kind: "reminder", title: "48h document reminder" },
      { offsetHours: 120, channel: "whatsapp", kind: "reminder", title: "5-day follow-up" },
    ],
  },
  {
    key: "private-wealth-meeting", name: "Private Wealth · consultation", platform: "nito", trigger: "wealth.consultation_booked",
    steps: [
      { offsetHours: 0, channel: "email", kind: "meeting_confirm", title: "Discovery Call confirmation + preparation checklist" },
      { offsetHours: -24, dueFrom: "slot", channel: "email", kind: "meeting_reminder", title: "24h reminder" },
      { offsetHours: -1, dueFrom: "slot", channel: "email", kind: "meeting_reminder", title: "1h reminder" },
      { offsetHours: 2, dueFrom: "slot", channel: "email", kind: "follow_up", title: "Post-meeting follow-up" },
    ],
  },
  {
    key: "brokerage-intake", name: "Brokerage Builder · intake", platform: "nito", trigger: "brokerage.application_submitted",
    steps: [
      { offsetHours: 0, channel: "email", kind: "builder_started", title: "Assessment received + builder link" },
      { offsetHours: 72, channel: "email", kind: "reminder", title: "Blueprint nudge" },
    ],
  },
  {
    key: "brokerage-blueprint", name: "Brokerage Builder · blueprint", platform: "nito", trigger: "brokerage.blueprint_saved",
    steps: [
      { offsetHours: 0, channel: "email", kind: "blueprint_ready", title: "Blueprint summary + design call invitation" },
    ],
  },
  {
    key: "brokerage-design-call", name: "Brokerage Builder · design session", platform: "nito", trigger: "brokerage.design_call_booked",
    steps: [
      { offsetHours: 0, channel: "email", kind: "meeting_confirm", title: "Design Session confirmation" },
      { offsetHours: -24, dueFrom: "slot", channel: "email", kind: "meeting_reminder", title: "24h reminder" },
      { offsetHours: 2, dueFrom: "slot", channel: "email", kind: "follow_up", title: "Post-session next steps" },
    ],
  },
];

export async function ensureJourneys(workspaceId: string): Promise<void> {
  for (const j of SEED_JOURNEYS) {
    await db.journey.upsert({
      where: { workspaceId_key: { workspaceId, key: j.key } },
      update: {},
      create: { workspaceId, key: j.key, name: j.name, platform: j.platform, trigger: j.trigger, steps: JSON.stringify(j.steps) },
    });
  }
}

// ---- Contact upsert with source and consent --------------------------------
async function upsertIntelligenceContact(workspaceId: string, evt: IntelligenceEvent): Promise<string> {
  const email = evt.person.email.toLowerCase();
  const [firstName, ...rest] = (evt.person.name ?? "").split(" ");
  let contact = await db.contact.findFirst({ where: { workspaceId, email } });
  if (!contact) {
    contact = await db.contact.create({
      data: {
        workspaceId, email, firstName: firstName || null, lastName: rest.join(" ") || null,
        phone: evt.person.phone ?? null, country: evt.person.country ?? null, lastActivityAt: new Date(),
      },
    });
    await db.contactSource.create({
      data: { contactId: contact.id, source: `${evt.platform}: ${evt.eventType}`, sourceType: "api", detail: `Structured event from ${evt.platform}` },
    });
  } else {
    await db.contact.update({
      where: { id: contact.id },
      data: {
        firstName: contact.firstName ?? (firstName || null), lastName: contact.lastName ?? (rest.join(" ") || null),
        phone: contact.phone ?? (evt.person.phone ?? null), country: contact.country ?? (evt.person.country ?? null),
        lastActivityAt: new Date(),
      },
    });
  }
  if (evt.consent) {
    await db.consentRecord.create({
      data: { contactId: contact.id, channel: evt.consent.channel, status: "granted", lawfulBasis: evt.consent.basis, evidence: evt.consent.evidence ?? `${evt.platform} ${evt.eventType}`, actor: `platform:${evt.platform}` },
    });
  }

  // The Customer Intelligence Profile: per-platform structured attributes
  // merged into customFields under "intel".
  if (evt.attributes && Object.keys(evt.attributes).length) {
    const existing = (() => { try { return JSON.parse(contact.customFields ?? "{}"); } catch { return {}; } })() as Record<string, unknown>;
    const intel = (existing.intel ?? {}) as Record<string, unknown>;
    intel[evt.platform] = { ...(intel[evt.platform] as Record<string, unknown> ?? {}), ...evt.attributes, updatedAt: new Date().toISOString() };
    await db.contact.update({ where: { id: contact.id }, data: { customFields: JSON.stringify({ ...existing, intel }) } });
  }
  for (const name of (evt.tags ?? []).slice(0, 25)) {
    const clean = name.trim().slice(0, 80);
    if (!clean) continue;
    let tag = await db.tag.findFirst({ where: { workspaceId, name: clean } });
    if (!tag) tag = await db.tag.create({ data: { workspaceId, name: clean } });
    await db.contactTag.upsert({ where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } }, update: {}, create: { contactId: contact.id, tagId: tag.id } });
  }
  return contact.id;
}

// ---- Personalised content (data-driven, honestly labelled) -----------------
// Generated from the contact's own structured answers: checklist, reference,
// slot. Not an LLM; a deterministic personalisation engine. Every message
// says exactly why it exists.
function renderEmail(kind: string, ctx: Record<string, unknown>, firstName: string | null): { subject: string; html: string } {
  const name = firstName || "there";
  const ref = String(ctx.refCode ?? "");
  const checklist = Array.isArray(ctx.checklist) ? (ctx.checklist as string[]) : [];
  const slot = ctx.slot ? new Date(String(ctx.slot)).toLocaleString("en-GB", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }) : null;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const wrap = (title: string, body: string) => ({
    subject: title,
    html: `<div style="background:#f4f5f7;padding:28px 12px;font-family:-apple-system,'Segoe UI',Arial,sans-serif"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;border:1px solid #e5e7eb;padding:24px"><p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#111827">${esc(title)}</p>${body}<p style="margin:18px 0 0;font-size:10.5px;color:#9ca3af">Reference ${esc(ref)}. You are receiving this because of your application; reply to reach your private client manager.</p></div></div>`,
  });
  const list = checklist.length ? `<ul style="margin:10px 0 0;padding-left:18px;font-size:13px;color:#374151">${checklist.map((c) => `<li style="margin:3px 0">${esc(c)}</li>`).join("")}</ul>` : "";
  switch (kind) {
    case "application_received":
      return wrap(`Thank you, ${name}. Your private review has begun.`, `<p style="font-size:13px;color:#374151;line-height:1.6">Your application (${esc(ref)}) is with your private client manager. To prepare your review, it would help to have:</p>${list}<p style="margin-top:12px;font-size:12px;color:#6b7280">Secure upload opens with your client room; nothing is needed before your first conversation.</p>`);
    case "builder_started":
      return wrap(`${name}, your brokerage assessment is in.`, `<p style="font-size:13px;color:#374151;line-height:1.6">Your readiness assessment (${esc(ref)}) is recorded. Continue your Brokerage Blueprint whenever you are ready; your progress is saved.</p>`);
    case "blueprint_ready":
      return wrap(`Your Brokerage Blueprint is ready, ${name}.`, `<p style="font-size:13px;color:#374151;line-height:1.6">Blueprint ${esc(ref)} is saved. The next step is a 60-minute Brokerage Design Session with the NITO team to walk through the model, commercials and launch plan.</p>`);
    case "meeting_confirm":
      return wrap(`Confirmed: your session${slot ? ` · ${slot}` : ""}`, `<p style="font-size:13px;color:#374151;line-height:1.6">Your requested time${slot ? ` (${esc(slot)})` : ""} is being confirmed by your manager, who will send the meeting link. A short preparation checklist follows.</p>${list}`);
    case "meeting_reminder":
      return wrap(`Reminder: your session${slot ? ` · ${slot}` : ""}`, `<p style="font-size:13px;color:#374151;line-height:1.6">A reminder of your upcoming session${slot ? ` at ${esc(slot)}` : ""}.</p>`);
    case "follow_up":
      return wrap(`Following up on your session, ${name}`, `<p style="font-size:13px;color:#374151;line-height:1.6">Thank you for your time. Your manager is preparing the agreed next steps; expect them shortly.</p>`);
    default:
      return wrap(`An update on ${ref}`, `<p style="font-size:13px;color:#374151;line-height:1.6">There is an update on your application. Reply to this email to reach your manager.</p>${list}`);
  }
}

type JourneyStep = { offsetHours: number; dueFrom?: "enrolment" | "slot"; channel: string; kind: string; title: string };

function stepDueAt(step: JourneyStep, enrolledAt: Date, ctx: Record<string, unknown>): Date {
  const base = step.dueFrom === "slot" && ctx.slot ? new Date(String(ctx.slot)) : enrolledAt;
  return new Date(base.getTime() + step.offsetHours * 3600_000);
}

// ---- The engine ------------------------------------------------------------
export async function ingestIntelligenceEvent(workspaceId: string, evt: IntelligenceEvent): Promise<{ contactId: string; enrolled: string[] }> {
  await ensureJourneys(workspaceId);
  const contactId = await upsertIntelligenceContact(workspaceId, evt);

  await db.timelineItem.create({
    data: {
      contactId, type: evt.eventType, title: EVENT_TITLES[evt.eventType] ?? evt.eventType,
      detail: `${evt.platform}${evt.data?.refCode ? ` · ${String(evt.data.refCode)}` : ""}`,
      occurredAt: evt.occurredAt ? new Date(evt.occurredAt) : new Date(),
    },
  });
  await recomputeLeadScore(contactId).catch(() => undefined);

  const journeys = await db.journey.findMany({ where: { workspaceId, trigger: evt.eventType, active: true } });
  const enrolled: string[] = [];
  for (const j of journeys) {
    const steps = JSON.parse(j.steps) as JourneyStep[];
    const first = steps[0];
    const now = new Date();
    await db.journeyEnrolment.upsert({
      where: { journeyId_contactId: { journeyId: j.id, contactId } },
      // Re-triggering restarts the sequence with fresh context (e.g. a
      // rescheduled call carries the new slot).
      update: { stepIndex: 0, status: "active", context: JSON.stringify(evt.data ?? {}), nextDueAt: first ? stepDueAt(first, now, evt.data ?? {}) : null },
      create: { journeyId: j.id, contactId, context: JSON.stringify(evt.data ?? {}), nextDueAt: first ? stepDueAt(first, now, evt.data ?? {}) : null },
    });
    enrolled.push(j.key);
  }
  await audit(workspaceId, `platform:${evt.platform}`, "intel.event_ingested", `${evt.eventType} · ${evt.person.email} → ${enrolled.length} journey(s)`);

  // Immediate steps (offset 0) run in-request so the first personalised
  // message goes out with the application.
  await processDueJourneySteps(workspaceId);
  return { contactId, enrolled };
}

export async function processDueJourneySteps(workspaceId: string, now: Date = new Date()): Promise<{ executed: number }> {
  const due = await db.journeyEnrolment.findMany({
    where: { status: "active", nextDueAt: { lte: now }, journey: { workspaceId, active: true } },
    include: { journey: true },
    take: 50,
  });
  let executed = 0;
  const provider = activeProvider();
  for (const en of due) {
    const steps = JSON.parse(en.journey.steps) as JourneyStep[];
    const step = steps[en.stepIndex];
    if (!step) { await db.journeyEnrolment.update({ where: { id: en.id }, data: { status: "completed", nextDueAt: null } }); continue; }
    const ctx = (() => { try { return JSON.parse(en.context ?? "{}"); } catch { return {}; } })() as Record<string, unknown>;
    const contact = await db.contact.findUnique({ where: { id: en.contactId } });
    if (!contact?.email) { await db.journeyEnrolment.update({ where: { id: en.id }, data: { status: "stopped", nextDueAt: null } }); continue; }

    let outcome: string;
    if (step.channel === "email") {
      const consent = await db.consentRecord.findFirst({ where: { contactId: contact.id, channel: "email" }, orderBy: { createdAt: "desc" } });
      if (consent && consent.status !== "granted") {
        outcome = "skipped (email consent not granted)";
      } else {
        const { subject, html } = renderEmail(step.kind, ctx, contact.firstName);
        try {
          const r = await provider.send({ to: contact.email, subject, html, campaignSendId: `journey:${en.id}:${en.stepIndex}` });
          outcome = provider.name === "dev-log" ? `via dev-log (no real delivery)` : r.status === "sent" ? `sent via ${provider.name} (${r.providerId})` : `failed via ${provider.name}`;
        } catch { outcome = "failed (provider error)"; }
      }
    } else {
      // Honest: no SMS/WhatsApp/push provider is configured yet.
      outcome = `simulated (${step.channel} provider not configured)`;
    }
    await db.timelineItem.create({
      data: { contactId: contact.id, type: `journey_${step.channel}`, title: `${en.journey.name} · ${step.title}`, detail: `Step ${en.stepIndex + 1}/${steps.length} · ${step.channel} · ${outcome}` },
    });

    const nextIndex = en.stepIndex + 1;
    const next = steps[nextIndex];
    await db.journeyEnrolment.update({
      where: { id: en.id },
      data: next
        ? { stepIndex: nextIndex, nextDueAt: stepDueAt(next, en.createdAt, ctx) }
        : { stepIndex: nextIndex, status: "completed", nextDueAt: null },
    });
    executed++;
  }
  return { executed };
}
