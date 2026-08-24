// Assembles a RenderContext from the database and renders campaign content.
//
// Two render modes with one code path:
//   preview  - editor/preview iframe: sample personalisation, no coupon
//              generation (previews must never mint codes), feeds resolved.
//   send     - per recipient: real personalisation, per-send tracking URLs,
//              idempotent coupon issue, feeds resolved once per campaign.

import { db } from "@/lib/server/db";
import {
  renderEmail, parseBlocks, flattenBlocks, DEFAULT_BRAND,
  type EmailBlock, type RenderContext, type BrandTokens,
} from "./email-blocks";
import { issueCoupon } from "./promotions";
import { createHmac } from "node:crypto";

function origin(): string {
  // Every absolute link in an email hangs off this: the unsubscribe URL,
  // the tracking pixel, click redirects. Render injects its external URL, so
  // production can never fall back to localhost even when APP_ORIGIN is
  // unset. Localhost is dev-only, last.
  return (
    process.env.APP_ORIGIN ??
    process.env.RENDER_EXTERNAL_URL ??
    "http://localhost:3009"
  );
}

export function brandTokens(brand: {
  primaryColor: string; accentColor: string; backgroundColor: string; textColor: string;
  headingFont: string; bodyFont: string; buttonRadius: number;
  logoUrl: string | null; senderName: string | null; footerText: string | null;
  unsubscribeText: string; mailingAddress: string | null;
  menuLinks: string | null; socialLinks: string | null;
} | null): BrandTokens {
  if (!brand) return { ...DEFAULT_BRAND };
  const parse = (s: string | null) => {
    try { return s ? (JSON.parse(s) as { label: string; url: string }[]) : undefined; } catch { return undefined; }
  };
  return {
    primaryColor: brand.primaryColor,
    accentColor: brand.accentColor,
    backgroundColor: brand.backgroundColor,
    textColor: brand.textColor,
    headingFont: brand.headingFont,
    bodyFont: brand.bodyFont,
    buttonRadius: brand.buttonRadius,
    logoUrl: brand.logoUrl,
    senderName: brand.senderName,
    footerText: brand.footerText,
    unsubscribeText: brand.unsubscribeText,
    mailingAddress: brand.mailingAddress,
    menuLinks: parse(brand.menuLinks),
    socialLinks: parse(brand.socialLinks),
  };
}

/** Sign a poll-answer or unsubscribe token so email links cannot be forged. */
export function signEmailAction(payload: string): string {
  const secret = process.env.SESSION_SECRET ?? "dev-secret-not-for-prod";
  return createHmac("sha256", secret).update(`email-action.${payload}`).digest("base64url").slice(0, 24);
}

export function verifyEmailAction(payload: string, sig: string): boolean {
  return signEmailAction(payload) === sig;
}

const money = (n: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);

/**
 * Resolve dynamic product feeds into concrete product blocks so what is
 * rendered is a stable list, and the sent snapshot cannot change when the
 * catalogue does.
 */
export async function resolveFeeds(blocks: EmailBlock[], workspaceId: string, storeId?: string | null): Promise<EmailBlock[]> {
  const out: EmailBlock[] = [];
  for (const b of blocks) {
    // Feeds inside column halves resolve the same way as top-level ones.
    if (b.type === "columns" && (b.leftBlocks?.length || b.rightBlocks?.length)) {
      out.push({
        ...b,
        leftBlocks: b.leftBlocks?.length ? await resolveFeeds(b.leftBlocks, workspaceId, storeId) : b.leftBlocks,
        rightBlocks: b.rightBlocks?.length ? await resolveFeeds(b.rightBlocks, workspaceId, storeId) : b.rightBlocks,
      });
      continue;
    }
    if (b.type !== "product_feed") { out.push(b); continue; }
    const limit = Math.min(b.limit ?? 4, 8);
    const where = {
      store: { workspaceId, ...(storeId ? { id: storeId } : {}) },
      ...(b.rule === "category" && b.value ? { categories: { contains: b.value } } : {}),
      ...(b.rule === "interest_tag" && b.value ? { tags: { contains: b.value } } : {}),
    };
    let products = await db.product.findMany({
      where,
      orderBy: b.rule === "newest" ? { updatedAt: "desc" } : { price: "desc" },
      take: b.rule === "best_sellers" ? 200 : limit,
    });
    if (b.rule === "best_sellers") {
      // Best sellers means units actually sold, from recent order lines; the
      // price ordering above stays as the fallback when there is no order
      // history yet.
      const sold = await unitsSold(workspaceId, storeId);
      if (sold.size) {
        const ranked = products
          .map((p) => ({ p, units: sold.get(`${p.storeId}:${p.externalId}`) ?? 0 }))
          .filter((x) => x.units > 0)
          .sort((a, z) => z.units - a.units)
          .map((x) => x.p);
        if (ranked.length) products = ranked;
      }
      products = products.slice(0, limit);
    }
    if (products.length) {
      out.push({ id: b.id, type: "product_grid", productIds: products.map((p) => p.id), columns: 2, cta: b.cta });
    }
    // An empty feed renders nothing rather than a broken placeholder.
  }
  return out;
}

/** Units sold per product, keyed `storeId:externalProductId`, from recent orders. */
async function unitsSold(workspaceId: string, storeId?: string | null): Promise<Map<string, number>> {
  const orders = await db.order.findMany({
    where: {
      store: { workspaceId, ...(storeId ? { id: storeId } : {}) },
      status: { notIn: ["cancelled", "refunded", "failed"] },
    },
    orderBy: { placedAt: "desc" },
    take: 300,
    select: { storeId: true, items: true },
  });
  const sold = new Map<string, number>();
  for (const o of orders) {
    if (!o.items) continue;
    try {
      for (const line of JSON.parse(o.items) as { externalProductId?: string | number; qty?: number }[]) {
        if (line.externalProductId === undefined || line.externalProductId === null) continue;
        const key = `${o.storeId}:${line.externalProductId}`;
        sold.set(key, (sold.get(key) ?? 0) + (Number(line.qty) || 1));
      }
    } catch { /* unreadable order lines are skipped */ }
  }
  return sold;
}

/** Collect every product referenced by the blocks (columns included) into render form. */
async function productMap(blocks: EmailBlock[]): Promise<RenderContext["products"]> {
  const ids = new Set<string>();
  for (const b of flattenBlocks(blocks)) {
    if (b.type === "product") ids.add(b.productId);
    if (b.type === "product_grid") b.productIds.forEach((id) => ids.add(id));
  }
  const map: RenderContext["products"] = new Map();
  if (!ids.size) return map;
  const rows = await db.product.findMany({ where: { id: { in: [...ids] } } });
  for (const p of rows) {
    map.set(p.id, {
      title: p.title,
      price: money(p.price),
      salePrice: p.salePrice !== null ? money(p.salePrice) : null,
      imageUrl: p.imageUrl,
      url: p.url,
    });
  }
  return map;
}

async function globalsMap(blocks: EmailBlock[], workspaceId: string): Promise<RenderContext["globals"]> {
  const ids = flattenBlocks(blocks).filter((b) => b.type === "global").map((b) => (b as { elementId: string }).elementId);
  const map: RenderContext["globals"] = new Map();
  if (!ids.length) return map;
  const rows = await db.globalElement.findMany({ where: { id: { in: ids }, workspaceId, archived: false } });
  for (const el of rows) {
    try { map.set(el.id, JSON.parse(el.content) as EmailBlock); } catch { /* skip a corrupt element */ }
  }
  return map;
}

async function pollsMap(blocks: EmailBlock[], workspaceId: string): Promise<RenderContext["polls"]> {
  const ids = flattenBlocks(blocks).filter((b) => b.type === "poll").map((b) => (b as { pollId: string }).pollId);
  const map: RenderContext["polls"] = new Map();
  if (!ids.length) return map;
  const rows = await db.poll.findMany({ where: { id: { in: ids }, workspaceId } });
  for (const p of rows) {
    try {
      const options = (JSON.parse(p.options) as { key: string; label: string }[]).map((o) => ({ key: o.key, label: o.label }));
      map.set(p.id, { question: p.question, options });
    } catch { /* skip */ }
  }
  return map;
}

function personaliser(vars: Record<string, string>): (s: string) => string {
  return (s) => s.replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (_, key: string) => vars[key.toLowerCase()] ?? "");
}

/** Editor/preview render: sample data, no side effects, no coupon minting. */
export async function renderPreview(args: {
  workspaceId: string;
  blocks: EmailBlock[];
  brandId?: string | null;
}): Promise<{ html: string; textBody: string }> {
  const brand = args.brandId ? await db.brand.findFirst({ where: { id: args.brandId, workspaceId: args.workspaceId } }) : null;
  const store = brand?.storeId ?? null;
  const blocks = await resolveFeeds(args.blocks, args.workspaceId, store);

  // Promotions preview with a clearly fake code: previews must never mint.
  const coupons: RenderContext["coupons"] = new Map();
  for (const b of flattenBlocks(blocks)) {
    if (b.type === "coupon") {
      const promo = await db.promotion.findFirst({ where: { id: b.promotionId, workspaceId: args.workspaceId } });
      if (promo) {
        coupons.set(promo.id, {
          code: promo.mode === "shared" ? promo.sharedCode ?? "CODE" : `${promo.prefix}-PREVIEW`,
          label: promo.kind === "percent" ? `${promo.amount}% off` : promo.kind === "fixed" ? `${money(promo.amount, promo.currency)} off` : "Free shipping",
          terms: [promo.minSpend ? `Min spend ${money(promo.minSpend, promo.currency)}` : null, promo.expiryDays ? `Valid ${promo.expiryDays} days` : null, "One use per customer"].filter(Boolean).join(" · "),
        });
      }
    }
  }

  const ctx: RenderContext = {
    brand: brandTokens(brand),
    products: await productMap(blocks),
    globals: await globalsMap(blocks, args.workspaceId),
    coupons,
    polls: await pollsMap(blocks, args.workspaceId),
    urls: {
      open: `${origin()}/api/t/open/preview`,
      click: (to) => to,
      unsubscribe: `${origin()}/r/preview-unsubscribe`,
      pollAnswer: () => "#preview",
    },
    personalise: personaliser({ first_name: "Alex", last_name: "Example", email: "alex@example.com", "customer_coupon.code": "PREVIEW-CODE" }),
  };
  return renderEmail(blocks, ctx);
}

/**
 * Per-recipient render for a real send. Coupons are issued idempotently HERE,
 * at send time, never at preview.
 */
export async function renderForRecipient(args: {
  workspaceId: string;
  campaignId: string;
  sendId: string;
  contact: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  blocks: EmailBlock[]; // pre-resolved (feeds already concrete)
  brandId?: string | null;
}): Promise<{ html: string; textBody: string; unsubscribeUrl: string }> {
  const brand = args.brandId ? await db.brand.findFirst({ where: { id: args.brandId, workspaceId: args.workspaceId } }) : null;

  const coupons: RenderContext["coupons"] = new Map();
  const couponVars: Record<string, string> = {};
  for (const b of flattenBlocks(args.blocks)) {
    if (b.type === "coupon") {
      const issued = await issueCoupon({
        promotionId: b.promotionId,
        workspaceId: args.workspaceId,
        contactId: args.contact.id,
        email: args.contact.email,
        source: `campaign:${args.campaignId}`,
      });
      if (issued) {
        coupons.set(b.promotionId, issued);
        couponVars["customer_coupon.code"] = issued.code;
      }
    }
  }

  const sign = (pollId: string, optionKey: string) => {
    const payload = `${args.sendId}.${pollId}.${optionKey}`;
    return `${origin()}/api/t/poll/${args.sendId}?poll=${pollId}&option=${encodeURIComponent(optionKey)}&sig=${signEmailAction(payload)}`;
  };

  const ctx: RenderContext = {
    brand: brandTokens(brand),
    products: await productMap(args.blocks),
    globals: await globalsMap(args.blocks, args.workspaceId),
    coupons,
    polls: await pollsMap(args.blocks, args.workspaceId),
    urls: {
      open: `${origin()}/api/t/open/${args.sendId}`,
      click: (to) => `${origin()}/api/t/click/${args.sendId}?to=${encodeURIComponent(to)}`,
      unsubscribe: `${origin()}/api/t/unsub/${args.sendId}?sig=${signEmailAction(`unsub.${args.sendId}`)}`,
      pollAnswer: sign,
    },
    personalise: personaliser({
      first_name: args.contact.firstName ?? "",
      last_name: args.contact.lastName ?? "",
      email: args.contact.email,
      ...couponVars,
    }),
  };
  // The unsubscribe URL travels beside the body so the provider can carry it
  // as List-Unsubscribe headers. Gmail and Yahoo require the one-click header
  // pair from bulk senders; the footer link alone no longer satisfies them.
  return { ...renderEmail(args.blocks, ctx), unsubscribeUrl: ctx.urls.unsubscribe };
}
