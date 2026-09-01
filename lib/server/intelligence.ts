// The Communications OS intelligence layer. Business platforms (NITO first;
// Savvy Mango, HOMIKASA, Land Ledger, Frenzi, MyoTech next) post structured
// events here. Sendloom owns the Customer Intelligence Profile: identity,
// tags, per-platform attributes, lifecycle stage, timeline, score, and the
// journey engine that decides who is contacted, when, on which channel, with
// what content, and why. Consent arrives with the event and is recorded
// before any channel is used; unconfigured channels report honestly.
import { db } from "./db";
import { recordConsent } from "./consent";
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
  "myotech-es.deals_signup": "Joined the myotech.es deals club",
  "myotech-es.whatsapp_optin": "WhatsApp opt-in (myotech.es)",
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
  // MyoTech ES (myotech.es deals club). One immediate step and nothing
  // delayed, deliberately: with no cron, an offset-0 step is the only step
  // guaranteed to fire, and it fires in the same request as the signup.
  // The welcome email carries the standard 10% code from the event's own
  // data (discountCode, locale), rendered bilingually by deals_welcome.
  {
    key: "myotech-es-deals-welcome", name: "MyoTech ES · deals welcome", platform: "myotech-es", trigger: "myotech-es.deals_signup",
    steps: [
      { offsetHours: 0, channel: "email", kind: "deals_welcome", title: "10% welcome code" },
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
    // Machine grant: recordConsent's reactivation guard means a platform
    // event can never quietly undo an unsubscribe.
    await recordConsent({
      contactId: contact.id,
      workspaceId: contact.workspaceId,
      changes: [{ channel: evt.consent.channel as "email" | "sms" | "whatsapp", status: "granted" }],
      source: evt.consent.basis,
      actor: `platform:${evt.platform}`,
      evidence: evt.consent.evidence ?? `${evt.platform} ${evt.eventType}`,
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
export function renderEmail(
  kind: string,
  ctx: Record<string, unknown>,
  firstName: string | null,
): { subject: string; html: string; from?: string; replyTo?: string; text?: string } {
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

  // MyoTech ES speaks for its own brand, in the member's own language, and
  // never borrows the NITO wrapper with its private-client-manager footer.
  if (kind === "deals_welcome") {
    const code = String(ctx.discountCode ?? "MARBELLA10");
    const es = String(ctx.locale ?? "") === "es";
    // The shop's own WhatsApp number rides in with the event so this file
    // never hardcodes a business line. Digits only: wa.me refuses anything
    // else, and a broken link here is a dead call to action.
    const wa = String(ctx.whatsappNumber ?? "34672598404").replace(/\D/g, "") || "34672598404";
    // The message the member sends us, with their code already in it. One
    // tap from the inbox to a WhatsApp order that names the discount, so
    // nobody has to remember, copy or retype anything.
    const waMessage = es
      ? `Hola MyoTech ES, me he unido al club de ofertas. Mi código es ${code}. Quiero pedir:`
      : `Hi MyoTech ES, I have joined the deals club. My code is ${code}. I would like to order:`;
    const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(waMessage)}`;

    const subject = es
      ? `Tu código MyoTech ES del 10% está aquí`
      : `Your 10% MyoTech ES code is here`;
    const heading = es ? "Bienvenido al club de ofertas" : "Welcome to the deals club";
    const bodyLine = es
      ? "Gracias por unirte al club de ofertas de MyoTech ES. Este es tu código de bienvenida del 10%: dilo en tu pedido de WhatsApp y lo aplicamos."
      : "Thanks for joining the MyoTech ES deals club. This is your 10% welcome code: quote it in your WhatsApp order and we apply it.";
    const codeLabel = es ? "Tu código" : "Your code";
    const waCta = es ? "Pedir por WhatsApp con mi código" : "Order on WhatsApp with my code";
    // Sold out in Marbella is not sold out at all, and a member who thinks
    // this list is Marbella-only never asks. Said in the welcome, once.
    const ukLine = es
      ? "Tenemos stock en Marbella y también enviamos a todo Reino Unido, por este mismo WhatsApp y con el mismo código. Si algo aparece agotado en Marbella, pregúntanos y sale desde Reino Unido."
      : "We hold stock in Marbella and we ship across the UK too, on this same WhatsApp number and with the same code. If something shows as sold out in Marbella, just ask and it goes out from the UK.";
    const nextLine = es
      ? "A partir de ahora las ofertas y los avisos de reposición te llegan antes que a nadie."
      : "From now on, deals and restock alerts reach you before anyone else.";
    const footer = es
      ? "Recibes este correo porque te apuntaste al club de ofertas en myotech.es. Para darte de baja, responde con la palabra BAJA."
      : "You are receiving this because you joined the deals club at myotech.es. To unsubscribe, reply with the word UNSUBSCRIBE.";

    // The shop's own colours and wordmark, in an email-safe table layout:
    // ink navy ground, the white MyoTech logo, the teal accent on the code,
    // and WhatsApp's own #25D366 on the button. The green is stated three
    // ways (bgcolor attribute, td style, anchor style) because dark-mode
    // clients recolour anything they are allowed to.
    const site = process.env.MYOTECH_ES_SITE ?? "https://myotech.es";
    // The site header's own white wordmark, on the same ink ground it sits
    // on there. The full-colour mark needs a white band and breaks the dark
    // run of the email; this is the shop's actual masthead.
    const logo = `${site}/images/myotech-logo-white.png`;
    const WA_GREEN = "#25D366";
    const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
    const shopCta = es ? "Ver la gama de Marbella" : "See the Marbella range";

    return {
      subject,
      // A distinct sender name so the inbox separates Marbella from the UK
      // shop at a glance. The address stays on the verified sending domain;
      // MYOTECH_ES_FROM overrides it the day myotech.es is verified too.
      from: process.env.MYOTECH_ES_FROM ?? "MyoTech ES <hello@news.myotech.store>",
      replyTo: process.env.MYOTECH_ES_REPLY_TO ?? "hello@myotech.store",
      text: `${heading}\n\n${bodyLine}\n\n${codeLabel}: ${code}\n\n${waCta}: ${waUrl}\n\n${ukLine}\n\n${nextLine}\n\n${site}\n\n${footer}`,
      html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#0d1b2a" style="background-color:#0d1b2a;margin:0;padding:0"><tr><td align="center" style="padding:26px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="width:520px;max-width:520px;background-color:#111d2b;border:1px solid #1a2940;border-radius:16px;overflow:hidden">
<tr><td align="center" bgcolor="#0d1b2a" style="background-color:#0d1b2a;padding:24px 24px 18px;border-bottom:1px solid #1a2940">
<img src="${esc(logo)}" width="168" height="38" alt="MyoTech" style="display:block;width:168px;height:38px;border:0;outline:none;text-decoration:none">
<div style="margin:10px 0 0;font-family:${font};font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#00d4c8">Marbella</div>
</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 10px;font-family:${font};font-size:19px;font-weight:800;color:#ffffff;line-height:1.3">${esc(heading)}</p>
<p style="margin:0;font-family:${font};font-size:14px;color:#c9d4de;line-height:1.65">${esc(bodyLine)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0"><tr><td align="center" bgcolor="#0d1b2a" style="background-color:#0d1b2a;border:1px solid #00a89e;border-radius:12px;padding:15px 12px">
<div style="font-family:${font};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8195a5">${esc(codeLabel)}</div>
<div style="margin-top:5px;font-family:${font};font-size:26px;font-weight:800;letter-spacing:3px;color:#00d4c8">${esc(code)}</div>
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px"><tr><td align="center" bgcolor="${WA_GREEN}" style="background-color:${WA_GREEN};border-radius:999px">
<a href="${esc(waUrl)}" style="display:block;padding:14px 20px;font-family:${font};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;background-color:${WA_GREEN};border-radius:999px">${esc(waCta)}</a>
</td></tr></table>
<p style="margin:0;font-family:${font};font-size:13.5px;color:#c9d4de;line-height:1.65">${esc(ukLine)}</p>
<p style="margin:12px 0 0;font-family:${font};font-size:13.5px;color:#c9d4de;line-height:1.65">${esc(nextLine)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 0"><tr><td align="center" style="border-top:1px solid #1a2940;padding-top:16px">
<a href="${esc(site)}" style="font-family:${font};font-size:13px;font-weight:700;color:#00d4c8;text-decoration:none">${esc(shopCta)}</a>
</td></tr></table>
</td></tr>
<tr><td bgcolor="#0d1b2a" style="background-color:#0d1b2a;padding:16px 24px;border-top:1px solid #1a2940">
<p style="margin:0;font-family:${font};font-size:10.5px;color:#5f7280;line-height:1.6">${esc(footer)}</p>
</td></tr>
</table>
</td></tr></table>`,
    };
  }

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

// Opportunistic runner, same pattern as the abandoned-cart sweep: cheap
// enough to ride live event traffic (MyoTech tracking alone provides a
// steady pulse), throttled to once per 5 minutes per process. A cron on
// /api/v1/journeys/run remains the deterministic production trigger.
let lastJourneySweep = 0;
export async function sweepDueJourneys(): Promise<void> {
  if (Date.now() - lastJourneySweep < 5 * 60_000) return;
  lastJourneySweep = Date.now();
  const workspaces = await db.journeyEnrolment.findMany({
    where: { status: "active", nextDueAt: { lte: new Date() } },
    select: { journey: { select: { workspaceId: true } } },
    distinct: ["journeyId"],
    take: 10,
  });
  for (const w of new Set(workspaces.map((x) => x.journey.workspaceId))) {
    await processDueJourneySteps(w).catch(() => undefined);
  }
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
        const { subject, html, from, replyTo, text } = renderEmail(step.kind, ctx, contact.firstName);
        try {
          const r = await provider.send({
            to: contact.email, subject, html,
            campaignSendId: `journey:${en.id}:${en.stepIndex}`,
            // A journey that speaks for its own brand sends under that
            // brand's name; the rest fall back to the workspace sender.
            ...(from ? { from } : {}),
            ...(replyTo ? { replyTo } : {}),
            ...(text ? { text } : {}),
          });
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
