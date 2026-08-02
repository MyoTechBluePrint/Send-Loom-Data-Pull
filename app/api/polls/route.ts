// Polls: create, list, and results. An email poll is one question whose
// options can tag the contact and set a property; answers arrive as signed
// clicks recorded in PollAnswer.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const polls = await db.poll.findMany({
    where: { workspaceId: user.workspaceId },
    include: { answers: { select: { optionKey: true } } },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    ok: true,
    polls: polls.map((p) => {
      let options: { key: string; label: string; tag?: string; propertyKey?: string; propertyValue?: string }[] = [];
      try { options = JSON.parse(p.options); } catch { options = []; }
      const counts: Record<string, number> = {};
      for (const a of p.answers) counts[a.optionKey] = (counts[a.optionKey] ?? 0) + 1;
      return {
        id: p.id,
        question: p.question,
        createdAt: p.createdAt.toISOString(),
        totalAnswers: p.answers.length,
        options: options.map((o) => ({
          ...o,
          answers: counts[o.key] ?? 0,
          percent: p.answers.length ? Math.round(((counts[o.key] ?? 0) / p.answers.length) * 100) : 0,
        })),
      };
    }),
  });
}

const Create = z.object({
  question: z.string().min(1).max(200),
  options: z.array(z.object({
    label: z.string().min(1).max(120),
    tag: z.string().max(60).optional(),
    propertyKey: z.string().max(60).optional(),
    propertyValue: z.string().max(120).optional(),
  })).min(2).max(8),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "A poll needs a question and at least two options." }, { status: 400 });
  }

  const options = parsed.data.options.map((o, i) => ({ key: `o${i + 1}`, ...o }));
  const poll = await db.poll.create({
    data: { workspaceId: user.workspaceId, question: parsed.data.question, options: JSON.stringify(options) },
  });
  await audit(user.workspaceId, user.email, "poll.created", `'${parsed.data.question}' · ${options.length} options`);
  return Response.json({ ok: true, id: poll.id });
}
