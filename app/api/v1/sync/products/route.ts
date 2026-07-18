import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { readSignedBody } from "@/lib/server/apiAuth";

const ProductSchema = z.object({
  externalId: z.string(),
  title: z.string(),
  sku: z.string().optional(),
  price: z.number(),
  salePrice: z.number().optional(),
  imageUrl: z.string().optional(),
  url: z.string().optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  inventory: z.number().optional(),
});

const Body = z.object({ products: z.array(ProductSchema).max(500) });

export async function POST(req: NextRequest) {
  const auth = await readSignedBody(req);
  if (auth instanceof Response) return auth;
  const { store, body } = auth;

  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  for (const p of parsed.data.products) {
    await db.product.upsert({
      where: { storeId_externalId: { storeId: store.id, externalId: p.externalId } },
      create: {
        storeId: store.id, externalId: p.externalId, title: p.title, sku: p.sku,
        price: p.price, salePrice: p.salePrice, imageUrl: p.imageUrl, url: p.url,
        categories: p.categories ? JSON.stringify(p.categories) : null,
        tags: p.tags ? JSON.stringify(p.tags) : null, inventory: p.inventory,
      },
      update: {
        title: p.title, sku: p.sku, price: p.price, salePrice: p.salePrice,
        imageUrl: p.imageUrl, url: p.url,
        categories: p.categories ? JSON.stringify(p.categories) : null,
        tags: p.tags ? JSON.stringify(p.tags) : null, inventory: p.inventory,
      },
    });
  }

  await db.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });
  return Response.json({ ok: true, upserted: parsed.data.products.length });
}
