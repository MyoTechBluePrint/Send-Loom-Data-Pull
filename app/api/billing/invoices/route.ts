// Invoice and receipt history for the signed-in account.
import { db } from "@/lib/server/db";
import { currentUser } from "@/lib/server/permissions";
import { formatMoney } from "@/lib/server/subscription-states";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const sub = await db.subscription.findUnique({ where: { workspaceId: user.workspaceId } });
  if (!sub) return Response.json({ ok: true, invoices: [] });

  const invoices = await db.invoice.findMany({
    where: { subscriptionId: sub.id },
    orderBy: { issuedAt: "desc" },
    take: 60,
  });

  return Response.json({
    ok: true,
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      amountLabel: formatMoney(i.amountPence, i.currency),
      amountPence: i.amountPence,
      status: i.status,
      description: i.description,
      issuedAt: i.issuedAt.toISOString(),
      issuedLabel: i.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      paidAt: i.paidAt?.toISOString() ?? null,
      // Provider-hosted, so the PDF is always the authoritative copy.
      hostedUrl: i.hostedUrl,
      pdfUrl: i.pdfUrl,
    })),
  });
}
