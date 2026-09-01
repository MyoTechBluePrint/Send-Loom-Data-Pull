// Proof: the myotech.es deals club pipeline, end to end on this database.
//
// Exercises exactly what the Marbella site sends (two intelligence events per
// signup: the email leg with journey context, the WhatsApp leg with its own
// consent) through the real route handler with a real minted key for the
// myotech-es integration, and asserts every side effect Steve is relying on:
// contact, tags, per-channel consent with evidence, the welcome journey
// firing its one immediate step, the 10% code inside the rendered email in
// both languages, idempotent replays, and the seeded segment catching the
// member. Run: npx tsx scripts/proof-myotech-es.ts
import { NextRequest } from "next/server";
import { db } from "../lib/server/db";
import { ensureCatalog, createApiKey } from "../lib/server/platform";
import { renderEmail } from "../lib/server/intelligence";
import { evaluateSegmentMembers, type Rule } from "../lib/server/segments";
import { POST as intelligencePost } from "../app/api/v1/intelligence/route";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const STAMP = `t${Math.abs(Date.now() % 1_000_000)}`;
const EMAIL = `deals.proof.${STAMP}@example.com`;
const PHONE = "+34600111222";

async function post(secretKey: string, body: Record<string, unknown>) {
  const req = new NextRequest("http://localhost/api/v1/intelligence", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  } as ConstructorParameters<typeof NextRequest>[1]);
  const res = await intelligencePost(req);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

// The exact payloads lib/sendloomPush.ts on the Marbella site builds. If the
// site's wire format drifts from what this proof sends, update BOTH.
const emailLeg = (email: string) => ({
  requestId: `myotech-es:deals:email:${email}`,
  eventType: "myotech-es.deals_signup",
  platform: "myotech-es",
  person: { email, phone: PHONE },
  consent: {
    channel: "email",
    basis: "myotech.es deals club signup",
    evidence: "Acepto recibir ofertas y novedades de MyoTech por correo electrónico, y por WhatsApp si he dejado mi número. Puedes darte de baja en cualquier momento. (myotech.es, es)",
  },
  tags: ["myotech-es", "myotech-es:deals"],
  attributes: { site: "myotech.es", locale: "es" },
  data: { discountCode: "MARBELLA10", locale: "es", whatsappNumber: "34672598404" },
});

const whatsappLeg = (email: string) => ({
  requestId: `myotech-es:deals:whatsapp:${email}`,
  eventType: "myotech-es.whatsapp_optin",
  platform: "myotech-es",
  person: { email, phone: PHONE },
  consent: {
    channel: "whatsapp",
    basis: "myotech.es deals club WhatsApp opt-in",
    evidence: "Acepto recibir ofertas y novedades de MyoTech por correo electrónico, y por WhatsApp si he dejado mi número. Puedes darte de baja en cualquier momento. (myotech.es, es)",
  },
  tags: ["myotech-es", "myotech-es:deals"],
  attributes: { site: "myotech.es", locale: "es" },
});

async function main() {
  const ws = await db.workspace.findFirstOrThrow();

  console.log("Integration profile and key");
  await ensureCatalog(ws.id);
  const integration = await db.integration.findUnique({
    where: { workspaceId_slug: { workspaceId: ws.id, slug: "myotech-es" } },
  });
  check("myotech-es integration exists as its own profile", Boolean(integration));
  if (!integration) throw new Error("no integration");
  const key = await createApiKey({
    workspaceId: ws.id,
    integrationId: integration.id,
    name: `proof key ${STAMP}`,
    permissions: ["contacts:write", "events:write"],
  });
  check("key minted for the myotech-es integration", key.secretKey.startsWith("sk_live_"));

  console.log("Signup: email leg");
  const r1 = await post(key.secretKey, emailLeg(EMAIL));
  check("accepted", r1.status === 200 && r1.body.ok === true, JSON.stringify(r1.body));
  check(
    "enrolled in the deals welcome journey and nothing else",
    Array.isArray(r1.body.enrolledJourneys) &&
      (r1.body.enrolledJourneys as string[]).length === 1 &&
      (r1.body.enrolledJourneys as string[])[0] === "myotech-es-deals-welcome",
    JSON.stringify(r1.body.enrolledJourneys),
  );

  const contact = await db.contact.findFirst({
    where: { workspaceId: ws.id, email: EMAIL },
    include: { tags: { include: { tag: true } }, sources: true },
  });
  check("contact created", Boolean(contact));
  if (!contact) throw new Error("no contact");
  check("phone stored", contact.phone === PHONE);
  check(
    "tagged myotech-es and myotech-es:deals",
    ["myotech-es", "myotech-es:deals"].every((n) => contact.tags.some((t) => t.tag.name === n)),
  );
  check(
    "source is the api event from myotech-es",
    contact.sources.some((s) => s.sourceType === "api" && s.source.startsWith("myotech-es:")),
  );
  check("email consent granted on the mirror", contact.emailConsent === "granted");

  const emailConsent = await db.consentRecord.findFirst({
    where: { contactId: contact.id, channel: "email" },
    orderBy: { createdAt: "desc" },
  });
  check(
    "email consent evidence is the ticked sentence",
    Boolean(emailConsent && emailConsent.status === "granted" && (emailConsent.evidence ?? "").includes("Acepto recibir")),
  );

  console.log("Signup: WhatsApp leg");
  const r2 = await post(key.secretKey, whatsappLeg(EMAIL));
  check("accepted", r2.status === 200 && r2.body.ok === true, JSON.stringify(r2.body));
  check(
    "whatsapp leg enrols no journey",
    Array.isArray(r2.body.enrolledJourneys) && (r2.body.enrolledJourneys as string[]).length === 0,
  );
  const after = await db.contact.findUniqueOrThrow({ where: { id: contact.id } });
  check("whatsapp consent granted on the mirror", after.whatsappConsent === "granted");

  console.log("Welcome journey step");
  const enrolment = await db.journeyEnrolment.findFirst({
    where: { contactId: contact.id, journey: { key: "myotech-es-deals-welcome" } },
  });
  check(
    "one immediate step, then completed (no cron dependency)",
    Boolean(enrolment && enrolment.status === "completed" && enrolment.stepIndex === 1),
    enrolment ? `${enrolment.status} @ ${enrolment.stepIndex}` : "no enrolment",
  );
  const journeyLine = await db.timelineItem.findFirst({
    where: { contactId: contact.id, type: "journey_email" },
  });
  check(
    "welcome email step on the timeline",
    Boolean(journeyLine && journeyLine.title.includes("10% welcome code")),
    journeyLine?.title,
  );
  check(
    "email step was not skipped for consent",
    Boolean(journeyLine && !(journeyLine.detail ?? "").includes("skipped")),
    journeyLine?.detail ?? "",
  );

  console.log("Welcome email content");
  const ctx = { discountCode: "MARBELLA10", locale: "es", whatsappNumber: "34672598404" };
  const es = renderEmail("deals_welcome", ctx, null);
  check("spanish subject names MyoTech ES", es.subject.includes("10%") && es.subject.includes("MyoTech ES"));
  check("spanish body carries the code", es.html.includes("MARBELLA10"));
  check("spanish unsubscribe line", es.html.includes("BAJA"));
  const en = renderEmail("deals_welcome", { ...ctx, locale: "en" }, null);
  check("english subject names MyoTech ES", en.subject.includes("MyoTech ES"));
  check("english body carries the code", en.html.includes("MARBELLA10") && en.html.includes("UNSUBSCRIBE"));
  check("no NITO wording leaks in", !en.html.includes("private client manager") && !es.html.includes("manager"));

  // Sender identity: distinct display name from the UK shop's "MyoTech",
  // on the verified sending domain.
  check("sender name is MyoTech ES", (en.from ?? "").startsWith("MyoTech ES <"), en.from);
  check("sender stays on the verified domain", (en.from ?? "").includes("news.myotech.store"), en.from);
  check("reply-to set", Boolean(en.replyTo), en.replyTo);
  check("plain-text part exists and carries the code", (en.text ?? "").includes("MARBELLA10"));

  // The one-tap WhatsApp order button: right number, code pre-written into
  // the message, and the same link in the text part.
  const waMatch = /href="(https:\/\/wa\.me\/[^"]+)"/.exec(en.html);
  const waUrl = waMatch ? waMatch[1] : "";
  check("whatsapp button present", Boolean(waUrl), en.html.slice(0, 80));
  check("whatsapp link uses the number the site sent", waUrl.startsWith("https://wa.me/34672598404?text="));
  const decoded = decodeURIComponent(waUrl.split("text=")[1] ?? "");
  check("prefilled message contains the discount code", decoded.includes("MARBELLA10"), decoded);
  check("prefilled message names MyoTech ES", decoded.includes("MyoTech ES"), decoded);
  const esDecoded = decodeURIComponent((/href="https:\/\/wa\.me\/[^?]+\?text=([^"]+)"/.exec(es.html)?.[1]) ?? "");
  check("spanish prefilled message is spanish", esDecoded.includes("Hola") && esDecoded.includes("MARBELLA10"), esDecoded);
  check("text part carries the same whatsapp link", (en.text ?? "").includes("https://wa.me/34672598404"));

  // UK availability, said in both languages.
  check("english mentions UK shipping", /ship across the UK/i.test(en.html));
  check("spanish mentions UK shipping", /Reino Unido/.test(es.html));

  // Brand: the shop's wordmark and colours, not a generic card.
  check(
    "MyoTech logo embedded from an absolute https URL",
    en.html.includes('src="https://myotech.es/images/myotech-logo-white.png"'),
  );
  check("logo has alt text and fixed dimensions", /alt="MyoTech"/.test(en.html) && /width="168"/.test(en.html));
  // The colour wordmark is navy on one half: it needs the white band, or it
  // vanishes into the ink ground.
  check("logo sits on the ink header band", /bgcolor="#0d1b2a"[^>]*>\s*<img/.test(en.html));
  check("Marbella badge present", en.html.includes(">Marbella<"));
  check("ink navy ground", en.html.includes("#0d1b2a"));
  check("teal accent on the code", en.html.includes("#00d4c8"));
  check("links back to the shop", en.html.includes('href="https://myotech.es"'));
  // WhatsApp's own brand green, stated every way a dark-mode client might
  // otherwise override.
  const greens = (en.html.match(/#25D366/g) ?? []).length;
  check("WhatsApp button uses the real brand green in 3 places", greens >= 3, `${greens} occurrences`);
  check("no off-brand green sneaks in", !/#2[0-9a-f]d3[0-9a-f]{2}/i.test(en.html.replace(/#25D366/g, "")));

  // A missing or malformed number must never produce a broken wa.me link.
  const fallback = renderEmail("deals_welcome", { discountCode: "X10", locale: "en" }, null);
  check("falls back to the shop number when none is sent", fallback.html.includes("https://wa.me/34672598404"));
  const messy = renderEmail("deals_welcome", { discountCode: "X10", locale: "en", whatsappNumber: "+34 672 598 404" }, null);
  check("formatted numbers are normalised to digits", messy.html.includes("https://wa.me/34672598404"));

  console.log("Idempotency");
  const linesBefore = await db.timelineItem.count({ where: { contactId: contact.id } });
  const replay = await post(key.secretKey, emailLeg(EMAIL));
  check("replayed email leg reports duplicate", replay.body.duplicate === true, JSON.stringify(replay.body));
  const linesAfter = await db.timelineItem.count({ where: { contactId: contact.id } });
  check("replay writes nothing", linesAfter === linesBefore, `${linesBefore} -> ${linesAfter}`);

  console.log("Segment");
  const segment = await db.segment.findFirst({
    where: { workspaceId: ws.id, name: "MyoTech ES Deals Club" },
    include: { rules: true },
  });
  check("MyoTech ES Deals Club segment exists (seed-plans)", Boolean(segment));
  if (segment) {
    const rules = segment.rules.map((r) => ({ field: r.field, operator: r.operator, value: r.value, exclude: r.exclude })) as Rule[];
    const members = await evaluateSegmentMembers(ws.id, segment.match as "all" | "any", rules);
    check("the new member is in it", members.includes(contact.id), `${members.length} members`);
  }

  console.log("Cleanup");
  await db.journeyEnrolment.deleteMany({ where: { contactId: contact.id } });
  await db.timelineItem.deleteMany({ where: { contactId: contact.id } });
  await db.consentRecord.deleteMany({ where: { contactId: contact.id } });
  await db.contactTag.deleteMany({ where: { contactId: contact.id } });
  await db.contactSource.deleteMany({ where: { contactId: contact.id } });
  await db.leadScore.deleteMany({ where: { contactId: contact.id } });
  await db.contact.delete({ where: { id: contact.id } });
  // Scoped to THIS run's stamped email, so the proof can never eat another
  // producer's idempotency ledger if it is ever pointed at shared data.
  await db.integrationRequest.deleteMany({ where: { id: { endsWith: `:${EMAIL}` } } });
  await db.apiKey.delete({ where: { id: key.keyId } });
  console.log("  test rows removed");

  console.log(`\n${passed} passed, ${failed} failed`);
  await db.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
