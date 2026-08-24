import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { readSignedBody } from "@/lib/server/apiAuth";

// WooCommerce sends null, not absence, for anything a product simply does
// not have: variable products have no single price, drafts have no image,
// most products have no SKU. The schema must accept the store as it really
// is, or one imperfect product 400s the whole batch — which is exactly how
// the MyoTech catalogue (and its order sync) sat unsynced for a month.
const ProductSchema = z.object({
  externalId: z.string(),
  title: z.string(),
  sku: z.string().nullish(),
  price: z.number().nullish(),
  salePrice: z.number().nullish(),
  imageUrl: z.string().nullish(),
  url: z.string().nullish(),
  categories: z.array(z.string()).nullish(),
  tags: z.array(z.string()).nullish(),
  inventory: z.number().nullish(),
});

const Body = z.object({ products: z.array(ProductSchema).max(500) });

export async function POST(req: NextRequest) {
  const auth = await readSignedBody(req);
  if (auth instanceof Response) return auth;
  const { store, body } = auth;

  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  for (const p of parsed.data.products) {
    // Nulls normalised at the boundary: the Product row keeps price 0 for
    // "no single price" (variable products) and null for genuinely absent
    // optionals, so nothing downstream meets undefined.
    const fields = {
      title: p.title, sku: p.sku ?? null,
      price: p.price ?? 0, salePrice: p.salePrice ?? null,
      imageUrl: p.imageUrl ?? null, url: p.url ?? null,
      categories: p.categories?.length ? JSON.stringify(p.categories) : null,
      tags: p.tags?.length ? JSON.stringify(p.tags) : null,
      inventory: p.inventory ?? null,
    };
    await db.product.upsert({
      where: { storeId_externalId: { storeId: store.id, externalId: p.externalId } },
      create: { storeId: store.id, externalId: p.externalId, ...fields },
      update: fields,
    });
  }

  await db.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });
  return Response.json({ ok: true, upserted: parsed.data.products.length });
}
