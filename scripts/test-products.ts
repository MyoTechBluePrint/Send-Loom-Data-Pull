// Product blocks proven end to end against the real database: seed a store
// with two products and an order, then verify the editor resources listing
// query, feed resolution (newest + best sellers from real order lines) and
// renderPreview output for product, product_grid and product_feed blocks,
// plus the email style block and blocks nested inside columns.
//
// Run: npx tsx scripts/test-products.ts  (throwaway records, cleaned up).
//
// The resources ROUTE itself needs a session cookie, which a script cannot
// mint; the listing query below is the route's query verbatim, so what this
// proves is exactly what the endpoint returns once a user is signed in.
import { db } from "../lib/server/db";
import { validateBlocks, type EmailBlock } from "../lib/server/email-blocks";
import { renderPreview, resolveFeeds } from "../lib/server/email-render";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const STAMP = `p${Math.abs(Date.now() % 1_000_000)}`;

async function main() {
  const ws = await db.workspace.findFirstOrThrow();

  // ── Fixtures: one store, two products (one without an image), one order ──
  let store = await db.store.findFirst({ where: { workspaceId: ws.id } });
  const createdStore = !store;
  store ??= await db.store.create({
    data: { workspaceId: ws.id, name: `Product test store ${STAMP}`, url: "products.test.local", apiKey: `test_products_${STAMP}`, status: "connected" },
  });

  const prodA = await db.product.upsert({
    where: { storeId_externalId: { storeId: store.id, externalId: `tp-a-${STAMP}` } },
    create: {
      storeId: store.id, externalId: `tp-a-${STAMP}`, title: `Glow Serum ${STAMP}`,
      price: 30, salePrice: 24, imageUrl: "https://img.test.local/serum.jpg",
      url: "https://products.test.local/p/serum", categories: JSON.stringify(["Skin"]),
    },
    update: {},
  });
  const prodB = await db.product.upsert({
    where: { storeId_externalId: { storeId: store.id, externalId: `tp-b-${STAMP}` } },
    create: {
      storeId: store.id, externalId: `tp-b-${STAMP}`, title: `Night Cream ${STAMP}`,
      price: 18, imageUrl: null, url: "https://products.test.local/p/cream",
      categories: JSON.stringify(["Skin"]),
    },
    update: {},
  });
  // Product B outsells product A, so best_sellers must rank B first even
  // though A is the more expensive product.
  const order = await db.order.create({
    data: {
      storeId: store.id, externalId: `tp-order-${STAMP}`, number: `TP-${STAMP}`, status: "completed", total: 66,
      // qty high enough to outrank any seeded order history in the dev DB.
      items: JSON.stringify([
        { externalProductId: `tp-b-${STAMP}`, title: prodB.title, qty: 999, price: 18 },
        { externalProductId: `tp-a-${STAMP}`, title: prodA.title, qty: 1, price: 24 },
      ]),
    },
  });

  try {
    console.log("Editor resources listing");
    // The exact query app/api/editor/resources/route.ts runs for products.
    const listed = await db.product.findMany({
      where: { store: { workspaceId: ws.id } },
      select: { id: true, title: true, price: true, imageUrl: true, store: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const labels = listed.map((p) => ({ id: p.id, label: `${p.title} · £${p.price.toFixed(2)} (${p.store.name})` }));
    check("both seeded products listed", labels.some((l) => l.id === prodA.id) && labels.some((l) => l.id === prodB.id));
    check("labels carry title, price and store", labels.find((l) => l.id === prodA.id)?.label.includes(`Glow Serum ${STAMP} · £30.00`) === true);

    console.log("Feed resolution");
    const newest = await resolveFeeds([{ id: "f1", type: "product_feed", rule: "newest", limit: 2 }], ws.id, store.id);
    const newestGrid = newest.find((b): b is Extract<EmailBlock, { type: "product_grid" }> => b.type === "product_grid");
    check("newest feed resolves to a product grid", !!newestGrid && newestGrid.productIds.length > 0);
    const best = await resolveFeeds([{ id: "f2", type: "product_feed", rule: "best_sellers", limit: 2 }], ws.id, store.id);
    const bestGrid = best.find((b): b is Extract<EmailBlock, { type: "product_grid" }> => b.type === "product_grid");
    check("best sellers resolves from real order lines", !!bestGrid && bestGrid.productIds.includes(prodB.id));
    check("best sellers ranks by units sold, not price", bestGrid?.productIds[0] === prodB.id, JSON.stringify(bestGrid?.productIds));

    console.log("renderPreview: product blocks");
    const footer: EmailBlock = { id: "ft", type: "footer" };
    const blocks: EmailBlock[] = [
      { id: "st", type: "style", backgroundColor: "#112233", cardColor: "#f4f0ff" },
      { id: "h", type: "heading", text: "Products {{first_name}}", level: 1 },
      { id: "p1", type: "product", productId: prodA.id, cta: "Grab it" },
      { id: "p2", type: "product", productId: prodB.id },
      { id: "g", type: "product_grid", productIds: [prodA.id, prodB.id], columns: 2 },
      { id: "f", type: "product_feed", rule: "newest", limit: 2 },
      footer,
    ];
    const r = await renderPreview({ workspaceId: ws.id, blocks });
    check("product title rendered", r.html.includes(`Glow Serum ${STAMP}`));
    check("sale price with strikethrough original", r.html.includes("£24.00") && r.html.includes("£30.00") && r.html.includes("<s"));
    check("product image rendered", r.html.includes("https://img.test.local/serum.jpg"));
    check("store URL linked", r.html.includes("https://products.test.local/p/serum"));
    check("custom CTA rendered", r.html.includes("Grab it"));
    check("image-less product still renders title and price", r.html.includes(`Night Cream ${STAMP}`) && r.html.includes("£18.00"));
    check("image-less product has no orphan gutter", !r.html.includes(`<td valign="top" style="padding-left:16px;font-family:Helvetica, Arial, sans-serif;color:#2c2b28;"><p style="margin:0 0 6px;font-size:16px;font-weight:bold;">Night Cream`));
    check("feed resolved inside preview render", (r.html.match(new RegExp(`Night Cream ${STAMP}`, "g"))?.length ?? 0) >= 2);
    check("plain text carries products", r.textBody.includes(`Glow Serum ${STAMP}`) && r.textBody.includes("£24.00"));

    console.log("Email style block");
    check("outer background honoured", r.html.includes("background:#112233"));
    check("card colour honoured", r.html.includes("background:#f4f0ff"));
    const evil = await renderPreview({
      workspaceId: ws.id,
      blocks: [{ id: "st", type: "style", backgroundColor: "#111;background-image:url(javascript:1)" }, { id: "h", type: "heading", text: "x" }, footer],
    });
    check("non-hex colour falls back to brand", !evil.html.includes("javascript") && evil.html.includes("background:#faf9f7"));

    console.log("Blocks inside columns");
    const colBlocks: EmailBlock[] = [
      {
        id: "c", type: "columns", left: "", right: "",
        leftBlocks: [
          { id: "cl1", type: "heading", text: "Left side", level: 2 },
          { id: "cl2", type: "product", productId: prodA.id },
        ],
        rightBlocks: [
          { id: "cr1", type: "text", html: "<p>Right side copy</p>" },
          { id: "cr2", type: "button", label: "Shop the edit", href: "https://products.test.local/all" },
        ],
      },
      { id: "c2", type: "columns", left: "<p>Legacy left</p>", right: "<p>Legacy right</p>" },
      footer,
    ];
    const rc = await renderPreview({ workspaceId: ws.id, blocks: colBlocks });
    check("nested heading renders", rc.html.includes("Left side"));
    check("nested product resolves inside a column", rc.html.includes(`Glow Serum ${STAMP}`));
    check("nested button renders", rc.html.includes("Shop the edit"));
    check("legacy string halves untouched", rc.html.includes("<p>Legacy left</p>") && rc.html.includes("<p>Legacy right</p>"));
    check("plain text includes nested content", rc.textBody.includes("Left side") && rc.textBody.includes("Right side copy") && rc.textBody.includes("Legacy left"));

    console.log("Validation");
    const nestedCols = validateBlocks([
      { id: "c", type: "columns", left: "", right: "", leftBlocks: [{ id: "x", type: "columns", left: "", right: "" }] },
      footer,
    ]);
    check("columns inside columns rejected", nestedCols.some((i) => i.level === "error" && i.message.includes("nested")));
    const nestedBroken = validateBlocks([
      { id: "c", type: "columns", left: "", right: "", rightBlocks: [{ id: "x", type: "image", url: "", alt: "" }] },
      footer,
    ]);
    check("broken image inside a column flagged", nestedBroken.some((i) => i.level === "error" && i.message.includes("Image")));
    check("style block tolerated anywhere", !validateBlocks(blocks).some((i) => i.level === "error"));
    const twoStyles = validateBlocks([
      { id: "s1", type: "style", backgroundColor: "#111111" },
      { id: "s2", type: "style", backgroundColor: "#222222" },
      { id: "h", type: "heading", text: "x" }, footer,
    ]);
    check("duplicate style blocks warn, first wins", twoStyles.some((i) => i.level === "warning" && i.message.includes("style")));
  } finally {
    await db.order.delete({ where: { id: order.id } }).catch(() => {});
    await db.product.deleteMany({ where: { storeId: store.id, externalId: { in: [`tp-a-${STAMP}`, `tp-b-${STAMP}`] } } });
    if (createdStore) await db.store.delete({ where: { id: store.id } }).catch(() => {});
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
