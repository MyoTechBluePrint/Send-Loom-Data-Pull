// Universal Inbox extraction engine. Deterministic (regex + interest
// dictionary built from the workspace's own keywords/products) — no LLM.
// Confidence reflects how many hard identifiers were found. Approval is the
// only path from an ExtractedRecord to a Contact.
import { db } from "./db";
import { audit } from "./audit";
import { recomputeLeadScore } from "./scoring";

export type ExtractedFields = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  interests: string[];
  taskNote?: string;
  taskDue?: string;
  notes?: string;
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d[\d\s\-().]{7,}\d)/;
const TASK_RE = /\b(call|ring|phone|follow up|book|send (?:a )?quote|whatsapp|email) (?:her|him|them|back)?\b[^.\n]*/i;
const DUE_RE = /\b(today|tomorrow|tonight|this week|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const STOPWORDS = new Set(["asked", "about", "call", "and", "the", "for", "wants", "interested", "in", "re", "hi", "hello", "from", "please", "can", "you", "walk-in", "enquiry", "note", "urgent"]);

// Baseline interest dictionary; workspace keywords are merged in at runtime.
const BASE_INTERESTS = [
  "nad+", "nad", "weight loss", "weight management", "collagen", "sleep",
  "magnesium", "recovery", "peptide", "peptides", "longevity", "consultation",
  "metabolic", "glp-1", "menopause", "anti-ageing", "anti-aging", "energy",
];

async function interestDictionary(workspaceId: string): Promise<string[]> {
  const kws = await db.keyword.findMany({ where: { workspaceId }, select: { term: true } });
  const set = new Set(BASE_INTERESTS);
  kws.forEach((k) => set.add(k.term.toLowerCase()));
  return [...set].sort((a, b) => b.length - a.length); // longest match first
}

function guessName(text: string, email?: string, phone?: string): string | undefined {
  // Look in the first line before the first identifier for capitalised words.
  let head = text.split("\n")[0];
  if (phone) head = head.split(phone)[0];
  if (email) head = head.split(email)[0];
  const tokens = head.replace(/[^\p{L}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
  const isNameWord = (w: string) => w.length > 1 && /^\p{Lu}/u.test(w) && !STOPWORDS.has(w.toLowerCase());

  // Prefer the run of capitalised words directly before the identifier
  // ("Ben said his colleague Priya Nair <email>" → "Priya Nair").
  const trailing: string[] = [];
  for (let i = tokens.length - 1; i >= 0 && trailing.length < 3; i--) {
    if (isNameWord(tokens[i])) trailing.unshift(tokens[i]);
    else break;
  }
  if (trailing.length > 0) return trailing.join(" ");

  const words = tokens.filter(isNameWord);
  if (words.length === 0) return undefined;
  return words.slice(0, 3).join(" ");
}

export function extractFromText(text: string, dictionary: string[]): ExtractedFields {
  const email = text.match(EMAIL_RE)?.[0];
  const phone = text.match(PHONE_RE)?.[0]?.replace(/\s+/g, " ").trim();
  const name = guessName(text, email, phone);

  const lower = text.toLowerCase();
  const interests: string[] = [];
  for (const term of dictionary) {
    if (lower.includes(term) && !interests.some((i) => i.includes(term) || term.includes(i))) {
      interests.push(term);
    }
  }

  // Task verbs preceded by a negation ("no email given") are not tasks.
  let taskMatch: string | undefined;
  const taskExec = TASK_RE.exec(text);
  if (taskExec) {
    const before = text.slice(Math.max(0, taskExec.index - 12), taskExec.index).toLowerCase();
    if (!/\b(no|not|don't|dont|without)\s*$/.test(before)) taskMatch = taskExec[0].trim();
  }
  const due = taskMatch ? text.match(DUE_RE)?.[0] : undefined;

  return {
    name, email, phone,
    interests,
    taskNote: taskMatch,
    taskDue: due ? due[0].toUpperCase() + due.slice(1).toLowerCase() : undefined,
    notes: text.length <= 280 ? text : text.slice(0, 277) + "…",
  };
}

export function scoreConfidence(f: ExtractedFields): number {
  let c = 30;
  if (f.email) c += 30;
  if (f.phone) c += 22;
  if (f.name) c += 12;
  if (f.interests.length) c += 6;
  if (f.taskNote) c += 4;
  return Math.min(96, c);
}

// Split multi-lead pastes on blank lines; each chunk with an identifier
// becomes its own record.
function chunk(text: string): string[] {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text.trim()];
}

export async function createIntakeFromText(opts: {
  workspaceId: string;
  kind: string; // paste | whatsapp | email | note
  text: string;
  actor: string;
}) {
  const dictionary = await interestDictionary(opts.workspaceId);
  const chunks = chunk(opts.text);

  const title =
    opts.kind === "whatsapp" ? "WhatsApp forward" :
    opts.kind === "email" ? "Email forward" :
    opts.kind === "note" ? "Manual note" : "Pasted text";

  const item = await db.intakeItem.create({
    data: {
      workspaceId: opts.workspaceId, kind: opts.kind,
      title: `${title} · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      raw: opts.text, status: "review", source: "Universal Inbox",
    },
  });

  const records = [];
  for (const c of chunks) {
    const fields = extractFromText(c, dictionary);
    if (!fields.email && !fields.phone && chunks.length > 1) continue; // skip noise chunks in multi-pastes
    const confidence = scoreConfidence(fields);

    // Duplicate detection against existing contacts by email then phone.
    let duplicateOf: string | null = null;
    if (fields.email) {
      const existing = await db.contact.findUnique({
        where: { workspaceId_email: { workspaceId: opts.workspaceId, email: fields.email.toLowerCase() } },
      });
      duplicateOf = existing?.id ?? null;
    }
    if (!duplicateOf && fields.phone) {
      const digits = fields.phone.replace(/\D/g, "").slice(-9);
      if (digits.length >= 7) {
        const candidates = await db.contact.findMany({
          where: { workspaceId: opts.workspaceId, phone: { not: null } },
          select: { id: true, phone: true },
        });
        duplicateOf = candidates.find((x) => x.phone!.replace(/\D/g, "").endsWith(digits))?.id ?? null;
      }
    }

    records.push(
      await db.extractedRecord.create({
        data: {
          intakeId: item.id, fields: JSON.stringify(fields),
          confidence, duplicateOf,
        },
      })
    );
  }

  const avg = records.length ? Math.round(records.reduce((s, r) => s + r.confidence, 0) / records.length) : 0;
  await db.intakeItem.update({ where: { id: item.id }, data: { confidence: avg, processedAt: new Date() } });
  await audit(opts.workspaceId, opts.actor, "intake.created", `${title}: ${records.length} record(s) extracted, avg confidence ${avg}%`);

  return { item, records };
}

export async function approveRecord(recordId: string, actor: string, edited?: Partial<ExtractedFields>) {
  const record = await db.extractedRecord.findUniqueOrThrow({
    where: { id: recordId }, include: { intake: true },
  });
  if (record.status !== "pending") return { contactId: record.contactId, merged: record.status === "merged" };

  const fields: ExtractedFields = { ...JSON.parse(record.fields), ...edited };
  const workspaceId = record.intake.workspaceId;
  const email = fields.email?.toLowerCase() ?? null;

  let contactId: string;
  let merged = false;

  const existing = record.duplicateOf
    ? await db.contact.findUnique({ where: { id: record.duplicateOf } })
    : email
      ? await db.contact.findUnique({ where: { workspaceId_email: { workspaceId, email } } })
      : null;

  if (existing) {
    // Merge: fill blanks only, never clobber.
    const [firstName, ...rest] = (fields.name ?? "").split(" ");
    await db.contact.update({
      where: { id: existing.id },
      data: {
        firstName: existing.firstName ?? (firstName || undefined),
        lastName: existing.lastName ?? (rest.join(" ") || undefined),
        phone: existing.phone ?? fields.phone,
        notes: existing.notes ? existing.notes : fields.notes,
        lastActivityAt: new Date(),
      },
    });
    contactId = existing.id;
    merged = true;
  } else {
    const [firstName, ...rest] = (fields.name ?? "").split(" ");
    const contact = await db.contact.create({
      data: {
        workspaceId, email,
        firstName: firstName || null, lastName: rest.join(" ") || null,
        phone: fields.phone ?? null, notes: fields.notes ?? null,
        confidence: record.confidence, lastActivityAt: new Date(),
      },
    });
    contactId = contact.id;
    // Intake gives NO marketing consent: everything lands pending.
    await db.consentRecord.create({
      data: {
        contactId, channel: "email", status: "pending",
        lawfulBasis: "No consent evidence · captured via Universal Inbox",
        evidence: record.intake.title, actor,
      },
    });
  }

  await db.contactSource.create({
    data: {
      contactId, source: record.intake.title,
      sourceType: record.intake.kind, uploadedBy: actor,
      detail: fields.interests.length ? `Interests: ${fields.interests.join(", ")}` : undefined,
    },
  });

  for (const interest of fields.interests) {
    const tag = await db.tag.upsert({
      where: { workspaceId_name: { workspaceId, name: interest } },
      create: { workspaceId, name: interest }, update: {},
    });
    await db.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId: tag.id } },
      create: { contactId, tagId: tag.id }, update: {},
    });
  }

  let taskId: string | null = null;
  if (fields.taskNote) {
    const due = fields.taskDue?.toLowerCase();
    const dueAt = new Date();
    if (due === "tomorrow") dueAt.setDate(dueAt.getDate() + 1);
    else if (due && due.includes("week")) dueAt.setDate(dueAt.getDate() + 7);
    const task = await db.salesTask.create({
      data: {
        workspaceId, contactId, contactLabel: fields.name ?? email ?? fields.phone ?? "Unknown",
        type: fields.taskNote.length > 40 ? "Follow up" : fields.taskNote[0].toUpperCase() + fields.taskNote.slice(1),
        note: `From ${record.intake.title}: "${fields.notes ?? record.intake.raw.slice(0, 120)}"`,
        priority: "high", source: "intake", assigneeLabel: "Unassigned", dueAt,
      },
    });
    taskId = task.id;
  }

  await db.timelineItem.create({
    data: {
      contactId, type: "import",
      title: merged ? "Merged from Universal Inbox" : "Captured via Universal Inbox",
      detail: `${record.intake.title} · confidence ${record.confidence}%${fields.interests.length ? ` · interests: ${fields.interests.join(", ")}` : ""}`,
    },
  });

  await db.extractedRecord.update({
    where: { id: recordId },
    data: { status: merged ? "merged" : "approved", contactId },
  });

  const siblings = await db.extractedRecord.findMany({ where: { intakeId: record.intakeId } });
  const allDone = siblings.every((s) => s.status !== "pending");
  await db.intakeItem.update({
    where: { id: record.intakeId },
    data: { status: allDone ? "approved" : "partial" },
  });

  await recomputeLeadScore(contactId);
  await audit(workspaceId, actor, merged ? "intake.merged" : "intake.approved", `${record.intake.title} → contact ${contactId}${taskId ? " + sales task" : ""}`);

  return { contactId, merged, taskId };
}

export async function rejectRecord(recordId: string, actor: string) {
  const record = await db.extractedRecord.update({
    where: { id: recordId }, data: { status: "rejected" },
    include: { intake: true },
  });
  const siblings = await db.extractedRecord.findMany({ where: { intakeId: record.intakeId } });
  if (siblings.every((s) => s.status !== "pending")) {
    await db.intakeItem.update({
      where: { id: record.intakeId },
      data: { status: siblings.every((s) => s.status === "rejected") ? "rejected" : "approved" },
    });
  }
  await audit(record.intake.workspaceId, actor, "intake.rejected", `Record rejected from ${record.intake.title}`);
}
