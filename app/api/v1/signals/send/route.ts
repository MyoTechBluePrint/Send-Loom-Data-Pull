// POST /api/v1/signals/send — transactional signal delivery for NITO.
// Server-to-server, authenticated with the same integration API keys as the
// rest of v1. Durably idempotent by requestId (a retry can never duplicate a
// client email). Sendloom resolves the actual recipients from the audience
// policy — consent and suppression enforced here at send time — and the
// signal's trade levels are rendered verbatim, never recalculated.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { requireApiKey, ok } from "@/lib/server/platform";
import { activeProvider, resolveAudience } from "@/lib/server/sending";

type SignalBody = {
  requestId?: string;
  signalId?: string;
  version?: number;
  eventType?: string; // signal.published | signal.cancelled | signal.updated
  channel?: string; // email (this endpoint)
  audience?: { type?: string; testRecipient?: string; segmentRef?: string };
  brand?: { name?: string; color?: string; portalUrl?: string };
  signal?: {
    instrument?: string; direction?: string; entry?: string; stopLoss?: string;
    targets?: string; risk?: string; horizon?: string; rationale?: string; publishedAt?: string;
  };
  disclosure?: string;
  demo?: boolean;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function signalEmailHtml(b: Required<Pick<SignalBody, "brand" | "signal">> & SignalBody): { subject: string; html: string } {
  const s = b.signal, brand = b.brand;
  const color = /^#[0-9a-fA-F]{6}$/.test(brand.color ?? "") ? (brand.color as string) : "#16c47f";
  const dir = (s.direction ?? "").toUpperCase();
  const dirColor = dir === "SELL" ? "#dc2626" : "#16a34a";
  const cancelled = b.eventType === "signal.cancelled";
  const subject = cancelled
    ? `${brand.name}: signal cancelled · ${s.instrument}`
    : `${brand.name}: new ${dir} signal · ${s.instrument}`;
  const row = (k: string, v?: string) => v ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">${k}</td><td style="padding:6px 0;text-align:right;font-weight:700;font-size:13px;color:#111827">${esc(v)}</td></tr>` : "";
  const html = `
  <div style="background:#f4f5f7;padding:28px 12px;font-family:-apple-system,'Segoe UI',Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="background:${color};padding:16px 22px">
        <p style="margin:0;color:#ffffff;font-size:16px;font-weight:800">${esc(brand.name ?? "Your broker")}</p>
        <p style="margin:2px 0 0;color:rgba(255,255,255,0.85);font-size:11px">${cancelled ? "Signal update" : "New trading signal"}</p>
      </div>
      <div style="padding:22px">
        <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#111827">${esc(s.instrument ?? "")} <span style="color:${dirColor}">${esc(dir)}</span></p>
        ${cancelled ? `<p style="margin:0 0 12px;font-size:13px;color:#b45309;font-weight:700">This signal has been cancelled. Do not act on the original levels.</p>` : ""}
        <table style="width:100%;border-collapse:collapse;margin-top:8px">
          ${row("Entry zone", s.entry)}
          ${row("Stop loss", s.stopLoss)}
          ${row("Targets", s.targets)}
          ${row("Risk", s.risk)}
          ${row("Horizon", s.horizon)}
          ${row("Published", s.publishedAt)}
        </table>
        ${s.rationale ? `<p style="margin:14px 0 0;font-size:12.5px;line-height:1.6;color:#374151">${esc(s.rationale)}</p>` : ""}
        ${brand.portalUrl ? `<a href="${esc(brand.portalUrl)}" style="display:block;margin-top:18px;background:${color};color:#ffffff;text-decoration:none;text-align:center;padding:12px 0;border-radius:9px;font-size:14px;font-weight:700">View in your portal</a>` : ""}
        ${b.demo ? `<p style="margin:14px 0 0;font-size:11px;color:#b45309;font-weight:700">Demonstration signal · no live trading is available.</p>` : ""}
        <p style="margin:16px 0 0;font-size:10.5px;line-height:1.6;color:#9ca3af">${esc(b.disclosure ?? "A signal is a trade idea, not investment advice. Trading in leveraged products carries a high level of risk to your capital.")}</p>
      </div>
    </div>
  </div>`;
  return { subject, html };
}

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req, null);
  if (auth instanceof Response) return auth;

  let b: SignalBody;
  try { b = (await req.json()) as SignalBody; } catch {
    return Response.json({ ok: false, error: "Invalid JSON.", requestId: auth.requestId }, { status: 400 });
  }
  if (!b.requestId || !b.signalId || !b.signal?.instrument || b.channel !== "email") {
    return Response.json({ ok: false, error: "requestId, signalId, channel:'email' and signal.instrument are required.", requestId: auth.requestId }, { status: 400 });
  }

  // Durable idempotency: the same requestId is acknowledged, never re-sent.
  const dupe = await db.integrationRequest.findUnique({ where: { id: b.requestId } });
  if (dupe) {
    return ok({ accepted: true, duplicate: true, jobId: b.requestId, channel: "email", status: "already_processed" }, auth.requestId);
  }
  await db.integrationRequest.create({ data: { id: b.requestId, integrationId: auth.integrationId, kind: "signal.send", summary: `${b.signal.instrument} ${b.signal.direction ?? ""}` } });

  const { subject, html } = signalEmailHtml(b as Required<Pick<SignalBody, "brand" | "signal">> & SignalBody);
  const provider = activeProvider();

  // Audience: an explicit test recipient sends exactly one clearly-marked
  // email; otherwise Sendloom resolves consented, unsuppressed contacts.
  let recipients: string[] = [];
  let counts = { requested: 0, eligible: 0, suppressed: 0, noConsent: 0, noEmail: 0 };
  if (b.audience?.type === "test" && b.audience.testRecipient) {
    recipients = [b.audience.testRecipient];
    counts = { requested: 1, eligible: 1, suppressed: 0, noConsent: 0, noEmail: 0 };
  } else {
    const resolved = await resolveAudience(auth.workspaceId, b.audience?.segmentRef ? "segment" : null, b.audience?.segmentRef ?? null);
    recipients = resolved.eligible.map((r: { email: string }) => r.email).slice(0, 500);
    counts = {
      requested: resolved.eligible.length + resolved.skippedConsent + resolved.skippedSuppressed + resolved.skippedNoEmail,
      eligible: resolved.eligible.length, suppressed: resolved.skippedSuppressed,
      noConsent: resolved.skippedConsent, noEmail: resolved.skippedNoEmail,
    };
  }

  let sent = 0, failed = 0;
  const providerIds: string[] = [];
  for (const to of recipients) {
    try {
      const r = await provider.send({ to, subject, html, campaignSendId: `${b.requestId}:${sent + failed}` });
      if (r.status === "sent") { sent++; providerIds.push(r.providerId); } else failed++;
    } catch { failed++; }
  }

  await audit(auth.workspaceId, `integration:${auth.integrationSlug}`, "nito.signal_email",
    `${b.signal.instrument} ${b.signal.direction ?? ""} · ${sent} sent, ${failed} failed via ${provider.name}${b.audience?.type === "test" ? " (test recipient)" : ""}`);

  return ok({
    accepted: true, jobId: b.requestId, channel: "email", provider: provider.name,
    realDelivery: provider.name !== "dev-log",
    status: failed === 0 ? "sent" : sent > 0 ? "partially_sent" : "failed",
    counts: { ...counts, sent, failed },
    providerIds: providerIds.slice(0, 3),
  }, auth.requestId);
}
