// Contact Pack engine: freeze a cleaned contact group, render it in copy
// modes, export it as CSV variants, and log every extraction. Safe-export
// rules run at BUILD time and again at RENDER time (a contact suppressed
// after the pack was built is still excluded).
import { db } from "./db";
import { audit } from "./audit";

export type PackSummary = {
  id: string;
  name: string;
  source: string;
  total: number;
  eligible: number;
  withEmail: number;
  withPhone: number;
  excludedSuppressed: number;
  excludedUnsubscribed: number;
  excludedNoRoute: number;
  duplicatesRemoved: number;
  suggestedUse: string | null;
  simulated: boolean;
  createdBy: string;
  createdAt: Date;
};

async function eligibilityFor(workspaceId: string, contactIds: string[]) {
  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds } },
    include: { consents: { where: { channel: "email" }, orderBy: { createdAt: "desc" }, take: 1 }, score: true, tags: { include: { tag: true } }, sources: { orderBy: { createdAt: "asc" }, take: 1 }, tasks: { where: { status: "open" }, take: 1 } },
  });
  const suppressions = new Set(
    (await db.suppressionRecord.findMany({ where: { workspaceId } })).map((s) => s.email)
  );

  const eligible: typeof contacts = [];
  let excludedSuppressed = 0, excludedUnsubscribed = 0, excludedNoRoute = 0;

  for (const c of contacts) {
    const consent = c.consents[0]?.status;
    if (c.email && suppressions.has(c.email)) { excludedSuppressed++; continue; }
    if (consent === "suppressed") { excludedSuppressed++; continue; }
    if (consent === "withdrawn") { excludedUnsubscribed++; continue; }
    if (!c.email && !c.phone) { excludedNoRoute++; continue; }
    eligible.push(c);
  }
  return { contacts, eligible, excludedSuppressed, excludedUnsubscribed, excludedNoRoute };
}

export async function buildPack(opts: {
  workspaceId: string;
  name: string;
  source: string;
  contactIds: string[];
  createdBy: string;
  suggestedUse?: string;
}) {
  const unique = [...new Set(opts.contactIds)];
  const duplicatesRemoved = opts.contactIds.length - unique.length;
  const { eligible, excludedSuppressed, excludedUnsubscribed, excludedNoRoute } =
    await eligibilityFor(opts.workspaceId, unique);

  const pack = await db.contactPack.create({
    data: {
      workspaceId: opts.workspaceId,
      name: opts.name,
      source: opts.source,
      contactIds: JSON.stringify(eligible.map((c) => c.id)),
      total: opts.contactIds.length,
      eligible: eligible.length,
      withEmail: eligible.filter((c) => c.email).length,
      withPhone: eligible.filter((c) => c.phone).length,
      excludedSuppressed, excludedUnsubscribed, excludedNoRoute, duplicatesRemoved,
      suggestedUse: opts.suggestedUse ?? suggestUse(eligible.length, eligible.filter((c) => c.email).length, eligible.filter((c) => c.phone).length),
      createdBy: opts.createdBy,
    },
  });
  await audit(opts.workspaceId, opts.createdBy, "pack.created", `'${opts.name}' from ${opts.source}: ${eligible.length} eligible of ${opts.contactIds.length}`);
  return pack;
}

function suggestUse(eligible: number, withEmail: number, withPhone: number): string {
  if (eligible === 0) return "Nothing contactable here: review consent before use.";
  if (withPhone > withEmail) return "Phone-heavy: best as a call sheet or WhatsApp follow-up list.";
  if (eligible <= 30) return "Small and clean: personal outreach or a BCC batch.";
  return "Email-ready: campaign draft or batched BCC outreach.";
}

export type CopyMode =
  | "emails" | "bcc" | "name_email" | "phones" | "whatsapp"
  | "call_sheet" | "outreach_rows" | "csv" | "mailchimp_csv" | "klaviyo_csv" | "crm_csv";

export const MODE_LABELS: Record<CopyMode, string> = {
  emails: "Emails (comma · Gmail)",
  bcc: "BCC block (semicolon · Outlook)",
  name_email: "Name <email>",
  phones: "Phone numbers",
  whatsapp: "WhatsApp follow-up list",
  call_sheet: "Call sheet",
  outreach_rows: "Full outreach rows",
  csv: "CSV (generic)",
  mailchimp_csv: "Mailchimp CSV",
  klaviyo_csv: "Klaviyo CSV",
  crm_csv: "CRM CSV",
};

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function renderPack(packId: string, mode: CopyMode, batch?: { index: number; size: number }) {
  const pack = await db.contactPack.findUniqueOrThrow({ where: { id: packId } });
  if (pack.simulated) {
    return { pack, text: "", count: 0, error: "Simulated pack: contains no real records to copy. Run a real import first." };
  }
  const allIds: string[] = JSON.parse(pack.contactIds);
  const ids = batch ? allIds.slice(batch.index * batch.size, (batch.index + 1) * batch.size) : allIds;
  // Re-check eligibility at render time.
  const { eligible } = await eligibilityFor(pack.workspaceId, ids);

  const name = (c: (typeof eligible)[number]) => [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.phone || "Unknown";
  const interest = (c: (typeof eligible)[number]) => c.tags.map((t) => t.tag.name).slice(0, 2).join("; ") || "–";
  const action = (c: (typeof eligible)[number]) => c.tasks[0]?.type ?? (c.score && c.score.score >= 60 ? "Follow up" : "Nurture");

  const withEmail = eligible.filter((c) => c.email);
  const withPhone = eligible.filter((c) => c.phone);

  let text = "";
  let count = eligible.length;
  switch (mode) {
    case "emails":
      text = withEmail.map((c) => c.email).join(", "); count = withEmail.length; break;
    case "bcc":
      text = withEmail.map((c) => c.email).join("; "); count = withEmail.length; break;
    case "name_email":
      text = withEmail.map((c) => `${name(c)} <${c.email}>`).join("\n"); count = withEmail.length; break;
    case "phones":
      text = withPhone.map((c) => c.phone!.replace(/[\s()-]/g, "")).join("\n"); count = withPhone.length; break;
    case "whatsapp":
      text = withPhone.map((c) => `${name(c)} — ${c.phone} — ${interest(c)}`).join("\n"); count = withPhone.length; break;
    case "call_sheet":
      text = ["Name | Phone | Interest | Notes | Next action",
        ...withPhone.map((c) => `${name(c)} | ${c.phone} | ${interest(c)} | ${(c.notes ?? "").split("\n")[0] || "–"} | ${action(c)}`)].join("\n");
      count = withPhone.length; break;
    case "outreach_rows":
      text = ["Name\tEmail\tPhone\tInterest\tSource\tLead score\tSuggested action",
        ...eligible.map((c) => [name(c), c.email ?? "", c.phone ?? "", interest(c), c.sources[0]?.source ?? "", String(c.score?.score ?? 0), action(c)].join("\t"))].join("\n");
      break;
    case "csv":
    case "crm_csv":
      text = ["first_name,last_name,email,phone,city,country,source,lead_score,tags,suggested_action",
        ...eligible.map((c) => [c.firstName ?? "", c.lastName ?? "", c.email ?? "", c.phone ?? "", c.city ?? "", c.country ?? "", c.sources[0]?.source ?? "", String(c.score?.score ?? 0), interest(c), action(c)].map(csvEscape).join(","))].join("\n");
      break;
    case "mailchimp_csv":
      text = ["Email Address,First Name,Last Name,Phone,Tags",
        ...withEmail.map((c) => [c.email!, c.firstName ?? "", c.lastName ?? "", c.phone ?? "", c.tags.map((t) => t.tag.name).join(";")].map(csvEscape).join(","))].join("\n");
      count = withEmail.length; break;
    case "klaviyo_csv":
      text = ["Email,First Name,Last Name,Phone Number,Source",
        ...withEmail.map((c) => [c.email!, c.firstName ?? "", c.lastName ?? "", c.phone ?? "", c.sources[0]?.source ?? ""].map(csvEscape).join(","))].join("\n");
      count = withEmail.length; break;
  }

  return { pack, text, count, error: null as string | null };
}

export async function logExport(opts: {
  workspaceId: string; packId?: string; user: string; dataType: string;
  source: string; format: string; contacts: number;
  excludedSuppressed?: number; excludedUnsubscribed?: number; duplicatesRemoved?: number;
  batch?: string; notes?: string;
}) {
  await db.exportLog.create({
    data: {
      workspaceId: opts.workspaceId, packId: opts.packId, user: opts.user,
      dataType: opts.dataType, source: opts.source, format: opts.format,
      contacts: opts.contacts,
      excludedSuppressed: opts.excludedSuppressed ?? 0,
      excludedUnsubscribed: opts.excludedUnsubscribed ?? 0,
      duplicatesRemoved: opts.duplicatesRemoved ?? 0,
      batch: opts.batch, notes: opts.notes,
    },
  });
}
