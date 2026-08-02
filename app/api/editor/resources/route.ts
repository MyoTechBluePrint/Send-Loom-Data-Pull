// Everything the email editor can insert, in one call: products, promotions,
// saved elements and polls, as id + label pairs. This is what replaces
// pasting ids into text fields.
import { db } from "@/lib/server/db";
import { currentUser } from "@/lib/server/permissions";
import { promotionLabel } from "@/lib/server/promotions";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const ws = user.workspaceId;

  const [products, promotions, elements, polls] = await Promise.all([
    db.product.findMany({
      where: { store: { workspaceId: ws } },
      select: { id: true, title: true, price: true, imageUrl: true, store: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    db.promotion.findMany({
      where: { workspaceId: ws, archived: false },
      orderBy: { createdAt: "desc" },
    }),
    db.globalElement.findMany({
      where: { workspaceId: ws, archived: false },
      select: { id: true, name: true, version: true },
      orderBy: { name: "asc" },
    }),
    db.poll.findMany({
      where: { workspaceId: ws },
      select: { id: true, question: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return Response.json({
    ok: true,
    products: products.map((p) => ({ id: p.id, label: `${p.title} · £${p.price.toFixed(2)} (${p.store.name})` })),
    promotions: promotions.map((p) => ({ id: p.id, label: `${p.name} · ${promotionLabel(p)}${p.mode === "shared" ? ` · ${p.sharedCode}` : ""}` })),
    elements: elements.map((e) => ({ id: e.id, label: `${e.name} (v${e.version})` })),
    polls: polls.map((p) => ({ id: p.id, label: p.question })),
  });
}
