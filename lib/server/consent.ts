// The one door consent walks through.
//
// The ConsentRecord ledger has always been the truth ("current state = the
// latest row per channel") and it stays that way. What this module adds is
// the rule that NOBODY writes the ledger directly any more: every grant,
// refusal, withdrawal and suppression comes through recordConsent(), which
// appends the ledger row, mirrors the new current state onto the contact's
// denormalised columns, drops the change into the contact's timeline, and
// leaves an audit line. One writer, so the mirror can never drift from the
// ledger it summarises.
//
// House rules enforced here rather than at every call site:
//  - An opt-out is never overwritten by an opt-in from a machine. Only a
//    deliberate human change (allowReactivate) can bring somebody back from
//    withdrawn / suppressed / declined.
//  - "unknown" is not a ledger status. Asking to set it means "we know
//    nothing": allowed only from bulk review, and recorded honestly as a
//    pending row with the reason in evidence.
//  - Do Not Contact is a contact-level switch, not a channel status, and
//    flipping it never rewrites per-channel history.

import { db } from "./db";
import { audit } from "./audit";

export const CHANNELS = ["email", "sms", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Ledger vocabulary. "declined" = an explicit no that was never a yes. */
export type ConsentStatus =
  | "granted"
  | "declined"
  | "pending"
  | "withdrawn"
  | "suppressed";

/** What the contact columns may hold: the ledger words, or nothing-known. */
export type ConsentState = ConsentStatus | "unknown";

const COLUMN: Record<Channel, "emailConsent" | "smsConsent" | "whatsappConsent"> = {
  email: "emailConsent",
  sms: "smsConsent",
  whatsapp: "whatsappConsent",
};

/** States a machine must never write over. A person said no; it stands. */
const OPTED_OUT: ReadonlySet<string> = new Set([
  "withdrawn",
  "suppressed",
  "declined",
]);

export interface ConsentChange {
  channel: Channel;
  status: ConsentStatus;
}

export interface RecordConsentInput {
  contactId: string;
  workspaceId: string;
  changes: ConsentChange[];
  /** Where this came from, in words a person reads later: "Website form: Longevity quiz". */
  source: string;
  /** user email, "tracker", "system", "import:<batchId>" … */
  actor: string;
  /** Form snapshot, import batch, exact checkbox wording, etc. */
  evidence?: string;
  lawfulBasis?: string;
  /** A deliberate human decision may bring an opted-out contact back. */
  allowReactivate?: boolean;
  /** Skip the timeline entry (imports write their own batch-level story). */
  quiet?: boolean;
}

export interface RecordConsentResult {
  applied: ConsentChange[];
  /** Channels left untouched because an opt-out stands and reactivate was not allowed. */
  held: Channel[];
}

/**
 * Append to the ledger and mirror the result, for one contact.
 *
 * Never throws for the "held" case: a form re-granting over an unsubscribe is
 * normal traffic, and the answer is "no, and here is what stood".
 */
export async function recordConsent(
  input: RecordConsentInput,
): Promise<RecordConsentResult> {
  const contact = await db.contact.findUnique({
    where: { id: input.contactId },
    select: {
      id: true,
      workspaceId: true,
      emailConsent: true,
      smsConsent: true,
      whatsappConsent: true,
    },
  });
  if (!contact || contact.workspaceId !== input.workspaceId) {
    return { applied: [], held: [] };
  }

  const applied: ConsentChange[] = [];
  const held: Channel[] = [];

  for (const change of input.changes) {
    const current = contact[COLUMN[change.channel]];
    const bringingBack =
      OPTED_OUT.has(current) && !OPTED_OUT.has(change.status);
    if (bringingBack && !input.allowReactivate) {
      held.push(change.channel);
      continue;
    }
    if (current === change.status) continue; // nothing to say
    applied.push(change);
  }

  if (!applied.length) return { applied, held };

  const now = new Date();
  await db.$transaction([
    db.consentRecord.createMany({
      data: applied.map((c) => ({
        contactId: contact.id,
        channel: c.channel,
        status: c.status,
        lawfulBasis: input.lawfulBasis ?? input.source,
        evidence: input.evidence ?? null,
        actor: input.actor,
      })),
    }),
    db.contact.update({
      where: { id: contact.id },
      data: {
        ...Object.fromEntries(
          applied.map((c) => [COLUMN[c.channel], c.status]),
        ),
        consentSource: input.source,
        consentAt: now,
        consentUpdatedBy: input.actor,
      },
    }),
    ...(input.quiet
      ? []
      : [
          db.timelineItem.create({
            data: {
              contactId: contact.id,
              type: "consent",
              title: timelineTitle(applied),
              detail: `Source: ${input.source}`,
              occurredAt: now,
            },
          }),
        ]),
  ]);

  await audit(
    input.workspaceId,
    input.actor,
    "consent.recorded",
    applied.map((c) => `${c.channel}:${c.status}`).join(",") +
      ` · ${input.source}`,
  );

  return { applied, held };
}

/** "Email and SMS marketing consent confirmed", in the timeline's voice. */
function timelineTitle(changes: ConsentChange[]): string {
  const names: Record<Channel, string> = {
    email: "Email",
    sms: "SMS",
    whatsapp: "WhatsApp",
  };
  const byStatus = new Map<ConsentStatus, string[]>();
  for (const c of changes) {
    byStatus.set(c.status, [...(byStatus.get(c.status) ?? []), names[c.channel]]);
  }
  const phrase: Record<ConsentStatus, string> = {
    granted: "marketing consent confirmed",
    declined: "marketing declined",
    pending: "marketing consent set to unknown",
    withdrawn: "marketing consent withdrawn",
    suppressed: "marketing suppressed",
  };
  return [...byStatus.entries()]
    .map(([status, channels]) => `${joinNames(channels)} ${phrase[status]}`)
    .join("; ");
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The contact-level kill switch.
 *
 * Separate from the per-channel record on purpose: turning it on does not
 * rewrite anybody's channel history, and turning it off reveals exactly the
 * states that were there before.
 */
export async function setDoNotContact(input: {
  contactId: string;
  workspaceId: string;
  value: boolean;
  actor: string;
  source: string;
}): Promise<boolean> {
  const contact = await db.contact.findUnique({
    where: { id: input.contactId },
    select: { id: true, workspaceId: true, doNotContact: true },
  });
  if (!contact || contact.workspaceId !== input.workspaceId) return false;
  if (contact.doNotContact === input.value) return true;

  await db.$transaction([
    db.contact.update({
      where: { id: contact.id },
      data: { doNotContact: input.value },
    }),
    db.timelineItem.create({
      data: {
        contactId: contact.id,
        type: "consent",
        title: input.value ? "Do Not Contact enabled" : "Do Not Contact removed",
        detail: `Source: ${input.source}`,
      },
    }),
  ]);
  await audit(
    input.workspaceId,
    input.actor,
    input.value ? "consent.do_not_contact_on" : "consent.do_not_contact_off",
    input.source,
  );
  return true;
}

/**
 * Channel eligibility, in one place, for senders and pack builders alike.
 *
 * A contact is eligible for a channel when the mirror says granted, Do Not
 * Contact is off, and they can actually be reached that way. Suppression
 * stays the email list it always was.
 */
export function eligibleForChannel(
  contact: {
    email?: string | null;
    phone?: string | null;
    emailConsent: string;
    smsConsent: string;
    whatsappConsent: string;
    doNotContact: boolean;
  },
  channel: Channel,
  suppressedEmails?: ReadonlySet<string>,
): { eligible: boolean; reason?: "do_not_contact" | "no_consent" | "opted_out" | "no_route" | "suppressed" } {
  if (contact.doNotContact) return { eligible: false, reason: "do_not_contact" };

  // Route and suppression before consent state, for the reporting's sake:
  // "this address unsubscribed" is the truer story than "no consent
  // recorded" when both are the case, and the suppression list is the
  // record of somebody actually saying stop.
  if (channel === "email") {
    const email = contact.email?.toLowerCase();
    if (!email) return { eligible: false, reason: "no_route" };
    if (suppressedEmails?.has(email)) return { eligible: false, reason: "suppressed" };
  } else if (!contact.phone) {
    return { eligible: false, reason: "no_route" };
  }

  const state =
    channel === "email"
      ? contact.emailConsent
      : channel === "sms"
        ? contact.smsConsent
        : contact.whatsappConsent;

  if (OPTED_OUT.has(state)) return { eligible: false, reason: "opted_out" };
  if (state !== "granted") return { eligible: false, reason: "no_consent" };

  return { eligible: true };
}

/** The audience arithmetic a campaign screen shows before anybody sends. */
export interface EligibilityBreakdown {
  total: number;
  eligible: number;
  noConsent: number;
  optedOut: number;
  suppressed: number;
  noRoute: number;
  doNotContact: number;
}

export function breakdownFor(
  contacts: Parameters<typeof eligibleForChannel>[0][],
  channel: Channel,
  suppressedEmails?: ReadonlySet<string>,
): EligibilityBreakdown {
  const out: EligibilityBreakdown = {
    total: contacts.length,
    eligible: 0,
    noConsent: 0,
    optedOut: 0,
    suppressed: 0,
    noRoute: 0,
    doNotContact: 0,
  };
  for (const c of contacts) {
    const r = eligibleForChannel(c, channel, suppressedEmails);
    if (r.eligible) out.eligible += 1;
    else if (r.reason === "no_consent") out.noConsent += 1;
    else if (r.reason === "opted_out") out.optedOut += 1;
    else if (r.reason === "suppressed") out.suppressed += 1;
    else if (r.reason === "no_route") out.noRoute += 1;
    else if (r.reason === "do_not_contact") out.doNotContact += 1;
  }
  return out;
}


/**
 * Recompute the mirror from the ledger, latest row per channel.
 *
 * The production backfill does this once in the migration; this function is
 * for everything that still writes the ledger directly and legitimately:
 * seed scripts, and any historical data that arrives by restore. It is the
 * same fold, expressed once, so "mirror equals ledger" is a property that
 * can always be re-established rather than merely hoped for.
 */
export async function syncConsentMirror(workspaceId: string) {
  const contacts = await db.contact.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  for (const { id } of contacts) {
    const rows = await db.consentRecord.findMany({
      where: { contactId: id, channel: { in: [...CHANNELS] } },
      orderBy: { createdAt: "desc" },
    });
    const latest = (ch: Channel) => rows.find((r) => r.channel === ch)?.status ?? "unknown";
    await db.contact.update({
      where: { id },
      data: {
        emailConsent: latest("email"),
        smsConsent: latest("sms"),
        whatsappConsent: latest("whatsapp"),
      },
    });
  }
}
