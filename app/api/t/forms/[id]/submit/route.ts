// PUBLIC multi-step form submission, called by the storefront tracker.
//
// One endpoint carries the whole journey: each step posts its answers with
// the submission id from the previous response, so abandonment is visible
// per step. Completion applies the shared condition engine: tags, contact
// properties, audiences (via segments reading tags/properties), journeys and
// an idempotent coupon.
//
// Consent honesty: a survey answer NEVER creates marketing consent. Only the
// explicit consent checkbox on the email step does.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { evaluateCondition, parseRules, applyActions, type Action } from "@/lib/server/conditions";
import { issueCoupon } from "@/lib/server/promotions";
import { eventIngestionService } from "@/lib/server/events";
import { checkRateLimit } from "@/lib/server/auth";

const Body = z.object({
  store: z.string().min(1), // store publicId, same handshake as the tracker
  submissionId: z.string().optional(),
  stepIndex: z.number().int().min(0).max(20),
  answers: z.record(z.string(), z.string().max(500)).default({}),
  consent: z.boolean().default(false),
  done: z.boolean().default(false),
});

function cors(req: NextRequest) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: cors(req) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const headers = cors(req);
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400, headers });
  const b = parsed.data;

  const store = await db.store.findUnique({ where: { publicId: b.store } });
  if (!store) return Response.json({ ok: false }, { status: 403, headers });

  // Abuse protection on a deliberately public endpoint: per-IP rate limit,
  // and a honeypot — the tracker renders a visually hidden "website" field
  // that humans never fill. A filled honeypot gets a fake success, so bots
  // learn nothing.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit(`form:${id}:${ip}`, 30, 15 * 60 * 1000)) {
    return Response.json({ ok: false, error: "Too many submissions." }, { status: 429, headers });
  }
  if (b.answers.website?.trim()) {
    return Response.json({ ok: true, submissionId: "ok", finished: true, nextStep: null, successMessage: "Done — thank you.", couponCode: null }, { headers });
  }

  const form = await db.form.findFirst({
    where: { id, workspaceId: store.workspaceId, status: "live" },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!form) return Response.json({ ok: false }, { status: 404, headers });

  // Identify or create the contact from an email answer. Browse-only steps
  // (no email yet) accumulate answers on the submission without a contact.
  const email = (b.answers.email ?? "").toLowerCase().trim() || null;
  let contactId: string | null = null;
  if (email) {
    const existing = await db.contact.findUnique({
      where: { workspaceId_email: { workspaceId: store.workspaceId, email } },
    });
    if (existing) {
      contactId = existing.id;
    } else {
      const created = await db.contact.create({
        data: {
          workspaceId: store.workspaceId,
          email,
          firstName: b.answers.first_name || b.answers.name || null,
          lastActivityAt: new Date(),
          confidence: 80,
        },
      });
      contactId = created.id;
      await db.contactSource.create({
        data: { contactId, source: `Form: ${form.name}`, sourceType: "popup", detail: store.name },
      });
    }
    // Consent comes ONLY from the explicit checkbox, never from answering.
    if (b.consent) {
      const latest = await db.consentRecord.findFirst({
        where: { contactId, channel: "email" }, orderBy: { createdAt: "desc" },
      });
      const optedOut = latest?.status === "withdrawn" || latest?.status === "suppressed";
      if (!optedOut && latest?.status !== "granted") {
        await db.consentRecord.create({
          data: {
            contactId, channel: "email", status: "granted",
            lawfulBasis: "Consent (form opt-in)",
            evidence: `Form "${form.name}" consent checkbox · ${form.consentLabel ?? "opt-in"}`,
            actor: `form:${form.id}`,
          },
        });
      }
    }
  }

  // Load or open the submission and append this step's answers.
  const step = form.steps[b.stepIndex] ?? null;
  const stepFields = step ? (JSON.parse(step.fields) as { key: string; label: string; tagMap?: Record<string, string>; propertyKey?: string }[]) : [];
  const answerRecords = Object.entries(b.answers).map(([key, answer]) => ({
    stepId: step?.id ?? "single",
    key,
    question: stepFields.find((f) => f.key === key)?.label ?? key,
    answer,
  }));

  let submission = b.submissionId
    ? await db.formSubmission.findFirst({ where: { id: b.submissionId, formId: form.id } })
    : null;
  const prior = submission ? (JSON.parse(submission.answers) as typeof answerRecords) : [];
  const merged = [...prior.filter((p) => !answerRecords.some((n) => n.key === p.key)), ...answerRecords];

  if (submission) {
    submission = await db.formSubmission.update({
      where: { id: submission.id },
      data: { answers: JSON.stringify(merged), lastStep: b.stepIndex, contactId: contactId ?? submission.contactId, email: email ?? submission.email },
    });
  } else {
    submission = await db.formSubmission.create({
      data: { formId: form.id, contactId, email, answers: JSON.stringify(merged), lastStep: b.stepIndex },
    });
  }

  const allAnswers: Record<string, string> = {};
  for (const r of merged) allAnswers[r.key] = r.answer;
  const effectiveContact = contactId ?? submission.contactId;

  // Field-level tag maps and properties for the answers just given.
  const fieldActions: Action[] = [];
  for (const f of stepFields) {
    const answer = b.answers[f.key];
    if (answer === undefined) continue;
    const mappedTag = f.tagMap?.[answer];
    if (mappedTag) fieldActions.push({ action: "add_tag", tag: mappedTag });
    if (f.propertyKey) fieldActions.push({ action: "set_property", key: f.propertyKey, value: answer });
  }

  // Step rules through the shared engine.
  const ruleActions: Action[] = [];
  for (const rule of parseRules(step?.rules)) {
    const hit = await evaluateCondition(rule.if, allAnswers, effectiveContact ? { id: effectiveContact, workspaceId: store.workspaceId } : null);
    if (hit) ruleActions.push(...rule.then);
  }

  const applied = await applyActions(store.workspaceId, effectiveContact, [...fieldActions, ...ruleActions], `form:${form.id}`);

  // Completion: coupon (configured on the form or requested by a rule),
  // funnel event, audit.
  let couponCode: string | null = null;
  const isFinal = b.done || b.stepIndex >= form.steps.length - 1 || form.steps.length === 0;
  if (isFinal) {
    await db.formSubmission.update({ where: { id: submission.id }, data: { completed: true } });
    const promotionIds = [...applied.couponPromotions, ...(form.promotionId ? [form.promotionId] : [])];
    if (effectiveContact && promotionIds.length) {
      const issued = await issueCoupon({
        promotionId: promotionIds[0],
        workspaceId: store.workspaceId,
        contactId: effectiveContact,
        email: email ?? submission.email,
        source: `form:${form.id}`,
      });
      if (issued) {
        couponCode = issued.code;
        await db.formSubmission.update({ where: { id: submission.id }, data: { couponCodeId: issued.couponCodeId } });
      }
    }
    if (email) {
      await eventIngestionService.process({
        workspaceId: store.workspaceId,
        storeId: store.id,
        type: "popup_submitted",
        email,
        origin: req.headers.get("origin") ?? undefined,
        payload: { formId: form.id, formName: form.name, steps: form.steps.length || 1, hostname: req.headers.get("origin")?.replace(/^https?:\/\//, "") },
      });
    }
    await audit(store.workspaceId, `form:${form.id}`, "form.completed", `'${form.name}' completed${email ? ` by ${email}` : ""}${applied.tagsAdded.length ? ` · tags: ${applied.tagsAdded.join(", ")}` : ""}${couponCode ? ` · coupon issued` : ""}`);
  }

  // Routing for the tracker: which step next, or the success state.
  const nextStep = applied.goToStep ?? (b.stepIndex + 1 < form.steps.length ? b.stepIndex + 1 : null);
  const finished = isFinal || nextStep === null;

  return Response.json({
    ok: true,
    submissionId: submission.id,
    finished,
    nextStep: finished ? null : nextStep,
    successMessage: applied.successMessage ?? form.successMessage ?? "Done — check your inbox soon.",
    couponCode: couponCode ?? (finished ? form.offerCode || null : null),
  }, { headers });
}
