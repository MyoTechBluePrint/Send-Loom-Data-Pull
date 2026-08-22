// Import pipeline: parse → map → quality review → confirm. The wizard talks to
// this via /api/imports. Safe rules (V3 brief §5): never auto-overwrite consent,
import { recordConsent, setDoNotContact } from "./consent";
// never reactivate unsubscribed, suppressed stay unmarketable, sources are
// append-only, every batch is audited.
import Papa from "papaparse";
import { db } from "./db";
import { audit } from "./audit";
import { eventIngestionService } from "./events";
import { guard } from "./billing/guard";

export const PLATFORM_FIELDS = [
  "email", "firstName", "lastName", "phone", "country", "city", "postcode",
  "productInterest", "keywordInterest", "source", "campaign", "consent",
  "emailConsent", "smsConsent", "whatsappConsent", "doNotContact",
  "consentDate", "consentSource",
  "orderValue", "lastOrderDate", "tags", "notes", "custom", "ignore",
] as const;
export type PlatformField = (typeof PLATFORM_FIELDS)[number];

const DETECTORS: [RegExp, PlatformField][] = [
  // Channel-specific consent columns first: "email_consent" must never fall
  // into the plain email matcher below it.
  [/^(email[-_ ]?consent|email[-_ ]?opt[-_ ]?in|email[-_ ]?marketing)$/i, "emailConsent"],
  [/^(sms[-_ ]?consent|sms[-_ ]?opt[-_ ]?in|sms[-_ ]?marketing|text[-_ ]?consent)$/i, "smsConsent"],
  [/^(whats[-_ ]?app[-_ ]?consent|whatsapp[-_ ]?opt[-_ ]?in|whatsapp[-_ ]?marketing|wa[-_ ]?consent)$/i, "whatsappConsent"],
  [/^(do[-_ ]?not[-_ ]?contact|dnc)$/i, "doNotContact"],
  [/^consent[-_ ]?date$/i, "consentDate"],
  [/^consent[-_ ]?source$/i, "consentSource"],
  [/^e[-_ ]?mail/i, "email"],
  [/^(first[-_ ]?name|fname|forename)$/i, "firstName"],
  [/^(last[-_ ]?name|lname|surname)$/i, "lastName"],
  [/^(phone|mobile|tel)/i, "phone"],
  [/^country$/i, "country"],
  [/^(city|town)$/i, "city"],
  [/^(post[-_ ]?code|zip)/i, "postcode"],
  [/interest/i, "productInterest"],
  [/^(source|signup[-_ ]?source|lead[-_ ]?source)$/i, "source"],
  [/^campaign/i, "campaign"],
  [/consent|opt[-_ ]?in|gdpr/i, "consent"],
  [/^(tags?)$/i, "tags"],
  [/note/i, "notes"],
  [/(order|purchase)[-_ ]?(value|total)/i, "orderValue"],
  // Spanish-style labels
  [/^nombre$/i, "firstName"],
  [/^apellidos?$/i, "lastName"],
  [/^correo/i, "email"],
  [/^tel[eé]fono$/i, "phone"],
  [/^ciudad$/i, "city"],
  [/^pa[ií]s$/i, "country"],
  [/^notas$/i, "notes"],
  [/^(company|business|organisation|organization|empresa)$/i, "custom"],
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPOSABLE_DOMAINS = new Set(["tempmail.io", "mailinator.com", "guerrillamail.com", "10minutemail.com", "yopmail.com"]);
const TRUTHY = new Set(["true", "yes", "1", "y", "granted", "subscribed", "opted_in", "opted in"]);
// An explicit no in a consent column is a decline to remember, never a blank.
const FALSY = new Set(["false", "no", "0", "n", "declined", "unsubscribed", "opted_out", "opted out", "withdrawn"]);

export function detectMapping(columns: string[]): Record<string, PlatformField> {
  const mapping: Record<string, PlatformField> = {};
  for (const col of columns) {
    const hit = DETECTORS.find(([re]) => re.test(col.trim()));
    mapping[col] = hit ? hit[1] : "custom";
  }
  return mapping;
}

export async function createBatchFromCsv(opts: {
  workspaceId: string; name: string; source: string; sourceType: string;
  uploadedBy: string; csv: string; projectId?: string; classification?: string; folderId?: string;
}) {
  const parsed = Papa.parse<Record<string, string>>(opts.csv.trim(), { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 3) {
    throw new Error(`CSV parse failed: ${parsed.errors[0].message}`);
  }
  const columns = parsed.meta.fields ?? [];
  const mapping = detectMapping(columns);

  const batch = await db.importBatch.create({
    data: {
      workspaceId: opts.workspaceId, name: opts.name, source: opts.source,
      sourceType: opts.sourceType, uploadedBy: opts.uploadedBy,
      projectId: opts.projectId ?? null, classification: opts.classification ?? null,
      folderId: opts.folderId ?? null,
      status: "mapping", mapping: JSON.stringify(mapping), totalRows: parsed.data.length,
    },
  });

  await db.importRow.createMany({
    data: parsed.data.map((row, i) => ({
      batchId: batch.id, rowNumber: i + 1, raw: JSON.stringify(row),
    })),
  });

  await audit(opts.workspaceId, opts.uploadedBy, "import.created", `Uploaded '${opts.name}' (${parsed.data.length} rows, ${columns.length} columns)`);

  return {
    batchId: batch.id, columns, mapping,
    preview: parsed.data.slice(0, 5), totalRows: parsed.data.length,
  };
}

function mapRow(raw: Record<string, string>, mapping: Record<string, PlatformField>) {
  const out: Partial<Record<Exclude<PlatformField, "custom" | "ignore">, string>> & { custom: Record<string, string> } = { custom: {} };
  for (const [col, field] of Object.entries(mapping)) {
    const value = (raw[col] ?? "").trim();
    if (!value || field === "ignore") continue;
    if (field === "custom") out.custom[col] = value;
    else out[field] = value;
  }
  return out;
}

export async function reviewBatch(batchId: string, mapping: Record<string, PlatformField>) {
  const batch = await db.importBatch.findUniqueOrThrow({ where: { id: batchId }, include: { rows: true } });
  const suppressions = new Set(
    (await db.suppressionRecord.findMany({ where: { workspaceId: batch.workspaceId } })).map((s) => s.email)
  );

  const seenInFile = new Set<string>();
  const counts = { ready: 0, duplicate: 0, invalid: 0, blocked: 0, missingConsent: 0, needsReview: 0 };
  const issues: { rowNumber: number; email: string; issue: string; status: string }[] = [];

  for (const row of batch.rows) {
    const mapped = mapRow(JSON.parse(row.raw), mapping);
    const email = mapped.email?.toLowerCase() ?? "";
    let status = "ready";
    let issue: string | null = null;

    if (!email || !EMAIL_RE.test(email)) {
      status = "invalid"; issue = email ? "Invalid email format" : "Missing email";
    } else if (DISPOSABLE_DOMAINS.has(email.split("@")[1])) {
      status = "blocked"; issue = "Disposable email domain";
    } else if (suppressions.has(email)) {
      status = "blocked"; issue = "Matches suppression list · will not be reactivated";
    } else if (seenInFile.has(email)) {
      status = "duplicate"; issue = "Duplicate within file";
    } else {
      seenInFile.add(email);
      const existing = await db.contact.findUnique({
        where: { workspaceId_email: { workspaceId: batch.workspaceId, email } },
      });
      if (existing) { status = "duplicate"; issue = "Existing contact · merge strategy applies"; }
    }

    const hasConsent = mapped.consent !== undefined && TRUTHY.has(mapped.consent.toLowerCase());
    // A channel-specific consent cell answers the question just as well as
    // the generic column: a file that says sms_consent=yes was not shipped
    // without consent information.
    const hasChannelConsent = [mapped.emailConsent, mapped.smsConsent, mapped.whatsappConsent]
      .some((v) => v !== undefined && v.trim() !== "");
    if (status === "ready" && !hasConsent && !hasChannelConsent) {
      counts.missingConsent++;
      if (!mapped.consent) { status = "needs_review"; issue = "No consent column value · held for review"; }
    }

    if (status === "ready") counts.ready++;
    else if (status === "duplicate") counts.duplicate++;
    else if (status === "invalid") counts.invalid++;
    else if (status === "blocked") counts.blocked++;
    else if (status === "needs_review") counts.needsReview++;

    await db.importRow.update({ where: { id: row.id }, data: { status, issue } });
    if (issue && issues.length < 25) issues.push({ rowNumber: row.rowNumber, email: email || "(none)", issue, status });
  }

  await db.importBatch.update({
    where: { id: batchId },
    data: {
      status: "review", mapping: JSON.stringify(mapping),
      readyRows: counts.ready, duplicateRows: counts.duplicate, invalidRows: counts.invalid,
      blockedRows: counts.blocked, missingConsentRows: counts.missingConsent,
    },
  });

  return { counts, issues, totalRows: batch.totalRows };
}

export async function confirmBatch(opts: {
  batchId: string;
  duplicateStrategy: "merge_newest" | "merge_existing" | "skip" | "overwrite";
  tags: string[];
  lawfulBasis: string;
  createSegment: boolean;
  actor: string;
}) {
  const batch = await db.importBatch.findUniqueOrThrow({ where: { id: opts.batchId }, include: { rows: true } });
  const mapping = JSON.parse(batch.mapping ?? "{}") as Record<string, PlatformField>;

  // Contact allowance, checked before a single row is written. Refusing the
  // whole import is kinder than importing half of it: the customer keeps a
  // file they can retry rather than a half-loaded list they have to reconcile.
  // Complimentary and enterprise workspaces skip this entirely.
  const importable = batch.rows.filter((r) => r.status !== "invalid" && r.status !== "blocked").length;
  const allowance = await guard(batch.workspaceId, "monthly_contacts", importable);
  if (!allowance.allowed) {
    return {
      ok: false as const,
      error: allowance.error,
      blockedBy: allowance.reason,
      upgradeTo: allowance.upgradeTo,
      wouldImport: importable,
      imported: 0, merged: 0, skipped: 0,
    };
  }

  const tagIds: string[] = [];
  for (const name of opts.tags) {
    const tag = await db.tag.upsert({
      where: { workspaceId_name: { workspaceId: batch.workspaceId, name } },
      create: { workspaceId: batch.workspaceId, name },
      update: {},
    });
    tagIds.push(tag.id);
  }

  let imported = 0, merged = 0, skipped = 0;

  for (const row of batch.rows) {
    if (row.status === "invalid" || row.status === "blocked") continue;
    const mapped = mapRow(JSON.parse(row.raw), mapping);
    const email = mapped.email!.toLowerCase();
    const hasConsent = mapped.consent !== undefined && TRUTHY.has((mapped.consent ?? "").toLowerCase());

    const existing = await db.contact.findUnique({
      where: { workspaceId_email: { workspaceId: batch.workspaceId, email } },
    });

    let contactId: string;
    if (existing) {
      if (opts.duplicateStrategy === "skip") {
        await db.importRow.update({ where: { id: row.id }, data: { status: "skipped", contactId: existing.id } });
        skipped++;
        continue;
      }
      const updates: Record<string, string> = {};
      const preferNew = opts.duplicateStrategy === "merge_newest" || opts.duplicateStrategy === "overwrite";
      for (const f of ["firstName", "lastName", "phone", "country", "city", "postcode", "notes"] as const) {
        const incoming = mapped[f];
        if (!incoming) continue;
        const current = existing[f];
        if (opts.duplicateStrategy === "overwrite" || !current || preferNew) updates[f] = incoming;
      }
      await db.contact.update({ where: { id: existing.id }, data: updates });
      contactId = existing.id;
      merged++;
      await db.importRow.update({ where: { id: row.id }, data: { status: "merged", contactId } });
    } else {
      const contact = await db.contact.create({
        data: {
          workspaceId: batch.workspaceId, email,
          firstName: mapped.firstName ?? null, lastName: mapped.lastName ?? null,
          phone: mapped.phone ?? null, country: mapped.country ?? null,
          city: mapped.city ?? null, postcode: mapped.postcode ?? null,
          notes: mapped.notes ?? null,
          customFields: Object.keys(mapped.custom).length ? JSON.stringify(mapped.custom) : null,
          confidence: hasConsent ? 85 : 60,
        },
      });
      contactId = contact.id;
      imported++;
      await db.importRow.update({ where: { id: row.id }, data: { status: "imported", contactId } });
    }

    // Source is ALWAYS appended, merge or create.
    await db.contactSource.create({
      data: {
        contactId, source: batch.name, sourceType: batch.sourceType,
        importBatchId: batch.id, uploadedBy: opts.actor,
        detail: mapped.source ?? batch.source,
      },
    });

    // Consent, per channel, through the one door. The generic "consent"
    // column keeps meaning email, exactly as before; the channel-specific
    // columns say what they say, and an explicit no is recorded as declined
    // rather than ignored. recordConsent's guard means nothing here can
    // silently reactivate an opted-out contact, and the Do Not Contact
    // column only ever switches the block ON from a file, never off.
    const changes: { channel: "email" | "sms" | "whatsapp"; status: "granted" | "declined" | "pending" }[] = [];
    const cell = (v: string | undefined): "granted" | "declined" | null => {
      if (v === undefined) return null;
      const t = v.trim().toLowerCase();
      if (TRUTHY.has(t)) return "granted";
      if (FALSY.has(t)) return "declined";
      return null;
    };
    const emailCell = cell(mapped.emailConsent) ?? (hasConsent ? "granted" : null);
    const smsCell = cell(mapped.smsConsent);
    const waCell = cell(mapped.whatsappConsent);
    if (emailCell) changes.push({ channel: "email", status: emailCell });
    else if (!existing) changes.push({ channel: "email", status: "pending" });
    if (smsCell) changes.push({ channel: "sms", status: smsCell });
    if (waCell) changes.push({ channel: "whatsapp", status: waCell });

    if (changes.length) {
      await recordConsent({
        contactId,
        workspaceId: batch.workspaceId,
        changes,
        source: mapped.consentSource?.trim() || `Import: ${batch.name}`,
        actor: `import:${batch.id}`,
        lawfulBasis: opts.lawfulBasis,
        evidence: `Import batch: ${batch.name}${mapped.consentDate ? ` · file consent date ${mapped.consentDate.trim()}` : ""}`,
        quiet: true, // the "imported" event already lands on the timeline
      });
    }
    if (cell(mapped.doNotContact) === "granted") {
      await setDoNotContact({
        contactId,
        workspaceId: batch.workspaceId,
        value: true,
        actor: `import:${batch.id}`,
        source: `Import: ${batch.name}`,
      });
    }

    for (const tagId of tagIds) {
      await db.contactTag.upsert({
        where: { contactId_tagId: { contactId, tagId } },
        create: { contactId, tagId }, update: {},
      });
    }

    await eventIngestionService.process({
      workspaceId: batch.workspaceId, type: "imported", email,
      payload: { batch: batch.name, merged: !!existing },
    });
  }

  let segmentId: string | null = null;
  if (opts.createSegment) {
    const seg = await db.segment.create({
      data: {
        workspaceId: batch.workspaceId, name: batch.name,
        description: `Everyone imported in batch '${batch.name}'`, match: "all",
        count: imported + merged, computedAt: new Date(),
        rules: { create: [{ field: "Import batch", operator: "is", value: batch.id }] },
      },
    });
    segmentId = seg.id;
  }

  await db.importBatch.update({
    where: { id: opts.batchId },
    data: { status: "complete", mergedRows: merged, completedAt: new Date(), options: JSON.stringify({ duplicateStrategy: opts.duplicateStrategy, tags: opts.tags }) },
  });

  await audit(batch.workspaceId, opts.actor, "import.completed", `'${batch.name}': ${imported} imported, ${merged} merged, ${skipped} skipped, ${batch.blockedRows} blocked`);

  return { ok: true as const, imported, merged, skipped, blocked: batch.blockedRows, segmentId };
}
