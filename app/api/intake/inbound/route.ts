// Inbound intake relay endpoint. A WhatsApp provider (Twilio-style) or an
// inbound-email service posts messages here with the shared secret; each one
// lands in the Universal Inbox for extraction and review, exactly like a
// manual paste. No relay provider is connected yet — this is the seam.
import { NextRequest } from "next/server";
import { z } from "zod";
import { createIntakeFromText } from "@/lib/server/extract";
import { demoWorkspaceId } from "@/lib/server/views";
import { audit } from "@/lib/server/audit";

const Body = z.object({
  channel: z.enum(["whatsapp", "email"]),
  from: z.string().max(200).optional(),
  subject: z.string().max(300).optional(),
  body: z.string().min(3).max(20_000),
});

export async function POST(req: NextRequest) {
  const secret = process.env.INTAKE_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-intake-secret") !== secret) {
    return Response.json({ ok: false, error: "Invalid or missing x-intake-secret" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const text = [parsed.data.from, parsed.data.subject, parsed.data.body].filter(Boolean).join("\n");
  const { item, records } = await createIntakeFromText({
    workspaceId, kind: parsed.data.channel, text,
    actor: `relay:${parsed.data.channel}`,
  });
  await audit(workspaceId, `relay:${parsed.data.channel}`, "intake.inbound", `${parsed.data.channel} relay delivered ${records.length} record(s)`);

  return Response.json({ ok: true, itemId: item.id, records: records.length });
}
