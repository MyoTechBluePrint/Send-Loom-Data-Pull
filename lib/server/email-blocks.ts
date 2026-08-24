// The email block system: one definition of what an email is made of, one
// renderer that turns blocks into email-client-safe HTML and a plain-text
// fallback, and one validator the editor and the send path both call.
//
// Rendering rules that keep the output deliverable everywhere:
//   - tables and inline styles only; no flexbox, no external CSS, no scripts
//   - a single 600px column that collapses gracefully on small screens
//   - every image gets alt text (validation nags until it does)
//   - the footer block always carries the unsubscribe link; sending refuses
//     content that lacks one
//
// Personalisation tokens: {{first_name}}, {{last_name}}, {{email}},
// {{customer_coupon.code}} (resolved per recipient at send time).

export type EmailBlock =
  | { id: string; type: "heading"; text: string; level?: 1 | 2; align?: Align }
  | { id: string; type: "text"; html: string; align?: Align }
  | { id: string; type: "image"; url: string; alt: string; href?: string; width?: number }
  | { id: string; type: "button"; label: string; href: string; align?: Align }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height?: number }
  // Column halves are either simple HTML strings (legacy) or arrays of real
  // blocks. When a side has blocks, they win over that side's string. Columns
  // never nest inside columns; validation enforces it.
  | { id: string; type: "columns"; left: string; right: string; leftBlocks?: EmailBlock[]; rightBlocks?: EmailBlock[] }
  // Email-level settings, not a layout block: at most one per email, kept out
  // of the editor's drag order. backgroundColor paints the outer canvas,
  // cardColor the 600px card; both fall back to the brand tokens.
  | { id: string; type: "style"; backgroundColor?: string; cardColor?: string }
  | { id: string; type: "logo"; url?: string; alt?: string; href?: string }
  | { id: string; type: "menu"; links: { label: string; url: string }[] }
  | { id: string; type: "social"; links: { label: string; url: string }[] }
  | { id: string; type: "product"; productId: string; showPrice?: boolean; cta?: string }
  | { id: string; type: "product_grid"; productIds: string[]; columns?: 2 | 3; cta?: string }
  | { id: string; type: "product_feed"; rule: "best_sellers" | "newest" | "category" | "interest_tag"; value?: string; limit?: number; cta?: string }
  | { id: string; type: "coupon"; promotionId: string; heading?: string; terms?: string; shopUrl?: string }
  | { id: string; type: "poll"; pollId: string }
  | { id: string; type: "global"; elementId: string; detached?: false } // linked reference
  | { id: string; type: "footer"; text?: string; address?: string };

type Align = "left" | "center" | "right";

export type BrandTokens = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  buttonRadius: number;
  logoUrl?: string | null;
  senderName?: string | null;
  footerText?: string | null;
  unsubscribeText?: string | null;
  mailingAddress?: string | null;
  menuLinks?: { label: string; url: string }[];
  socialLinks?: { label: string; url: string }[];
};

export const DEFAULT_BRAND: BrandTokens = {
  primaryColor: "#6d28d9",
  accentColor: "#8b5cf6",
  backgroundColor: "#faf9f7",
  textColor: "#2c2b28",
  headingFont: "Helvetica, Arial, sans-serif",
  bodyFont: "Helvetica, Arial, sans-serif",
  buttonRadius: 8,
};

/** Per-recipient values resolved at send time. */
export type RenderContext = {
  brand: BrandTokens;
  /** Resolved product cards, keyed by internal product id. */
  products: Map<string, { title: string; price: string; salePrice?: string | null; imageUrl?: string | null; url?: string | null }>;
  /** Resolved global elements, keyed by element id. */
  globals: Map<string, EmailBlock>;
  /** The recipient's coupon codes, keyed by promotion id. */
  coupons: Map<string, { code: string; label: string; terms: string }>;
  /** Poll definitions keyed by poll id; answer links are per-send. */
  polls: Map<string, { question: string; options: { key: string; label: string }[] }>;
  /** Signed per-send URLs. */
  urls: {
    open: string;
    click: (to: string) => string;
    unsubscribe: string;
    viewInBrowser?: string;
    pollAnswer?: (pollId: string, optionKey: string) => string;
  };
  personalise: (s: string) => string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Strip tags for the plain-text fallback. */
const toText = (html: string) => html.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

// Only colour values a picker can produce reach the HTML; anything else
// falls back to the brand token rather than being injected into a style
// attribute.
const isHexColor = (v: string | undefined): v is string =>
  !!v && /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v);

// padX narrows the horizontal gutter when a block renders inside a column
// half; the block HTML itself is identical to a top-level render.
function renderBlock(b: EmailBlock, ctx: RenderContext, text: string[], padX = 32): string {
  const { brand } = ctx;
  const p = ctx.personalise;
  const pad = (inner: string, py = 12) => `<tr><td style="padding:${py}px ${padX}px;">${inner}</td></tr>`;

  switch (b.type) {
    case "heading": {
      const size = b.level === 2 ? 20 : 26;
      text.push(p(b.text), "");
      return pad(`<h${b.level ?? 1} style="margin:0;font-family:${brand.headingFont};font-size:${size}px;line-height:1.3;color:${brand.textColor};text-align:${b.align ?? "left"};">${esc(p(b.text))}</h${b.level ?? 1}>`);
    }
    case "text":
      text.push(toText(p(b.html)), "");
      return pad(`<div style="font-family:${brand.bodyFont};font-size:15px;line-height:1.6;color:${brand.textColor};text-align:${b.align ?? "left"};">${p(b.html)}</div>`);
    case "image": {
      const img = `<img src="${esc(b.url)}" alt="${esc(b.alt)}" width="${b.width ?? 536}" style="display:block;width:100%;max-width:${b.width ?? 536}px;height:auto;border-radius:6px;" />`;
      return pad(b.href ? `<a href="${esc(ctx.urls.click(p(b.href)))}">${img}</a>` : img);
    }
    case "button": {
      text.push(`${p(b.label)}: ${p(b.href)}`, "");
      const align = b.align ?? "center";
      return pad(
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:${align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0"};"><tr><td style="background:${brand.primaryColor};border-radius:${brand.buttonRadius}px;"><a href="${esc(ctx.urls.click(p(b.href)))}" style="display:inline-block;padding:12px 28px;font-family:${brand.bodyFont};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(p(b.label))}</a></td></tr></table>`,
        16
      );
    }
    case "divider":
      return pad(`<hr style="border:none;border-top:1px solid #e7e6e1;margin:0;" />`, 8);
    case "spacer":
      return `<tr><td style="height:${b.height ?? 24}px;line-height:${b.height ?? 24}px;">&nbsp;</td></tr>`;
    case "columns": {
      // A side with nested blocks renders them through the same block HTML as
      // the top level (with a narrower gutter); otherwise the legacy HTML
      // string renders untouched. Nested columns are dropped defensively even
      // though validation refuses them.
      const side = (html: string, nested?: EmailBlock[]) => {
        if (nested?.length) {
          const rows = nested.filter((n) => n.type !== "columns").map((n) => renderBlock(n, ctx, text, 12)).join("");
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
        }
        text.push(toText(p(html)));
        return p(html);
      };
      const left = side(b.left, b.leftBlocks);
      const right = side(b.right, b.rightBlocks);
      text.push("");
      return pad(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="48%" valign="top" style="font-family:${brand.bodyFont};font-size:14px;line-height:1.6;color:${brand.textColor};">${left}</td><td width="4%">&nbsp;</td><td width="48%" valign="top" style="font-family:${brand.bodyFont};font-size:14px;line-height:1.6;color:${brand.textColor};">${right}</td></tr></table>`
      );
    }
    case "style":
      // Email-level settings; consumed by renderEmail, nothing to render here.
      return "";
    case "logo": {
      const url = b.url ?? ctx.brand.logoUrl;
      if (!url) return "";
      const img = `<img src="${esc(url)}" alt="${esc(b.alt ?? "Logo")}" width="140" style="display:block;max-width:140px;height:auto;margin:0 auto;" />`;
      return pad(b.href ? `<a href="${esc(ctx.urls.click(b.href))}">${img}</a>` : img, 20);
    }
    case "menu": {
      const links = b.links.length ? b.links : ctx.brand.menuLinks ?? [];
      if (!links.length) return "";
      text.push(links.map((l) => `${l.label}: ${l.url}`).join(" · "), "");
      return pad(
        `<div style="text-align:center;font-family:${brand.bodyFont};font-size:13px;">${links
          .map((l) => `<a href="${esc(ctx.urls.click(l.url))}" style="color:${brand.textColor};text-decoration:none;margin:0 10px;font-weight:600;">${esc(l.label)}</a>`)
          .join("")}</div>`,
        8
      );
    }
    case "social": {
      const links = b.links.length ? b.links : ctx.brand.socialLinks ?? [];
      if (!links.length) return "";
      return pad(
        `<div style="text-align:center;font-family:${brand.bodyFont};font-size:13px;">${links
          .map((l) => `<a href="${esc(ctx.urls.click(l.url))}" style="color:${brand.primaryColor};text-decoration:underline;margin:0 8px;">${esc(l.label)}</a>`)
          .join("")}</div>`,
        8
      );
    }
    case "product": {
      const prod = ctx.products.get(b.productId);
      if (!prod) return pad(`<div style="font-family:${brand.bodyFont};font-size:13px;color:#898781;">[Product unavailable]</div>`);
      text.push(`${prod.title} — ${prod.salePrice ?? prod.price}${prod.url ? ` (${prod.url})` : ""}`, "");
      // A product without an image renders text-only with no orphan gutter,
      // and an image without a product URL is not wrapped in a dead link.
      const img = prod.imageUrl ? `<img src="${esc(prod.imageUrl)}" alt="${esc(prod.title)}" width="170" style="display:block;width:170px;height:auto;border-radius:6px;" />` : "";
      return pad(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${img ? `<td width="180" valign="top">${prod.url ? `<a href="${esc(ctx.urls.click(prod.url))}">${img}</a>` : img}</td>` : ""}<td valign="top" style="${img ? "padding-left:16px;" : ""}font-family:${brand.bodyFont};color:${brand.textColor};"><p style="margin:0 0 6px;font-size:16px;font-weight:bold;">${esc(prod.title)}</p>${b.showPrice !== false ? `<p style="margin:0 0 10px;font-size:15px;">${prod.salePrice ? `<strong>${esc(prod.salePrice)}</strong> <s style="color:#898781;">${esc(prod.price)}</s>` : esc(prod.price)}</p>` : ""}${prod.url ? `<a href="${esc(ctx.urls.click(prod.url))}" style="font-size:14px;font-weight:bold;color:${brand.primaryColor};">${esc(b.cta ?? "Shop now")} →</a>` : ""}</td></tr></table>`
      );
    }
    case "product_grid": {
      const prods = b.productIds.map((id) => ({ id, p: ctx.products.get(id) })).filter((x) => x.p);
      if (!prods.length) return "";
      const cols = b.columns ?? 2;
      const w = Math.floor(100 / cols);
      const cells = prods
        .map(({ p: prod }) => {
          const cellImg = prod!.imageUrl ? `<img src="${esc(prod!.imageUrl)}" alt="${esc(prod!.title)}" width="160" style="display:block;width:100%;max-width:160px;height:auto;margin:0 auto 8px;border-radius:6px;" />` : "";
          return `<td width="${w}%" valign="top" style="padding:8px;font-family:${brand.bodyFont};text-align:center;">${cellImg ? (prod!.url ? `<a href="${esc(ctx.urls.click(prod!.url))}">${cellImg}</a>` : cellImg) : ""}<p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:${brand.textColor};">${esc(prod!.title)}</p><p style="margin:0 0 6px;font-size:13px;color:${brand.textColor};">${esc(prod!.salePrice ?? prod!.price)}</p>${prod!.url ? `<a href="${esc(ctx.urls.click(prod!.url))}" style="font-size:13px;font-weight:bold;color:${brand.primaryColor};">${esc(b.cta ?? "Shop")} →</a>` : ""}</td>`;
        });
      const rows: string[] = [];
      for (let i = 0; i < cells.length; i += cols) rows.push(`<tr>${cells.slice(i, i + cols).join("")}</tr>`);
      prods.forEach(({ p: prod }) => text.push(`${prod!.title} — ${prod!.salePrice ?? prod!.price}`));
      text.push("");
      return pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>`);
    }
    case "product_feed":
      // Feeds are resolved into concrete product ids BEFORE rendering (see
      // resolveFeeds in email-render). Reaching here unresolved means preview
      // without store data.
      return pad(`<div style="font-family:${brand.bodyFont};font-size:13px;color:#898781;border:1px dashed #e7e6e1;border-radius:6px;padding:14px;text-align:center;">Dynamic products: ${esc(b.rule)}${b.value ? ` · ${esc(b.value)}` : ""} (resolved at send time)</div>`);
    case "coupon": {
      const c = ctx.coupons.get(b.promotionId);
      if (!c) return pad(`<div style="font-family:${brand.bodyFont};font-size:13px;color:#898781;border:1px dashed #e7e6e1;border-radius:6px;padding:14px;text-align:center;">Coupon (generated per recipient at send time)</div>`);
      text.push(`${b.heading ?? "Your discount code"}: ${c.code} — ${c.label}. ${c.terms}`, "");
      return pad(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.backgroundColor};border:2px dashed ${brand.primaryColor};border-radius:10px;"><tr><td style="padding:20px;text-align:center;font-family:${brand.bodyFont};"><p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:${brand.textColor};">${esc(b.heading ?? "Your discount code")}</p><p style="margin:0 0 6px;font-size:24px;font-weight:bold;letter-spacing:2px;color:${brand.primaryColor};">${esc(c.code)}</p><p style="margin:0 0 10px;font-size:13px;color:${brand.textColor};">${esc(c.label)}</p>${b.shopUrl ? `<a href="${esc(ctx.urls.click(b.shopUrl))}" style="display:inline-block;padding:10px 24px;background:${brand.primaryColor};border-radius:${brand.buttonRadius}px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Shop now</a>` : ""}<p style="margin:10px 0 0;font-size:11px;color:#898781;">${esc(b.terms ?? c.terms)}</p></td></tr></table>`,
        16
      );
    }
    case "poll": {
      const poll = ctx.polls.get(b.pollId);
      if (!poll || !ctx.urls.pollAnswer) return "";
      text.push(poll.question, ...poll.options.map((o) => `- ${o.label}`), "");
      return pad(
        `<div style="font-family:${brand.bodyFont};text-align:center;"><p style="margin:0 0 12px;font-size:16px;font-weight:bold;color:${brand.textColor};">${esc(poll.question)}</p>${poll.options
          .map((o) => `<a href="${esc(ctx.urls.pollAnswer!(b.pollId, o.key))}" style="display:inline-block;margin:4px;padding:10px 20px;border:1.5px solid ${brand.primaryColor};border-radius:${brand.buttonRadius}px;font-size:14px;font-weight:600;color:${brand.primaryColor};text-decoration:none;">${esc(o.label)}</a>`)
          .join("")}</div>`,
        16
      );
    }
    case "global": {
      const el = ctx.globals.get(b.elementId);
      if (!el) return "";
      return renderBlock({ ...el, id: b.id }, ctx, text);
    }
    case "footer": {
      const unsub = ctx.brand.unsubscribeText ?? "Unsubscribe at any time.";
      const addr = b.address ?? ctx.brand.mailingAddress;
      text.push("---", b.text ?? ctx.brand.footerText ?? "", addr ?? "", `Unsubscribe: ${ctx.urls.unsubscribe}`);
      return pad(
        `<div style="font-family:${brand.bodyFont};font-size:12px;line-height:1.6;color:#898781;text-align:center;">${b.text ?? ctx.brand.footerText ? `<p style="margin:0 0 6px;">${esc(b.text ?? ctx.brand.footerText ?? "")}</p>` : ""}${addr ? `<p style="margin:0 0 6px;">${esc(addr)}</p>` : ""}<p style="margin:0;">${esc(unsub)} <a href="${esc(ctx.urls.unsubscribe)}" style="color:#898781;text-decoration:underline;">Unsubscribe</a>${ctx.urls.viewInBrowser ? ` · <a href="${esc(ctx.urls.viewInBrowser)}" style="color:#898781;text-decoration:underline;">View in browser</a>` : ""}</p></div>`,
        20
      );
    }
  }
}

/** Render blocks into a full email document plus a plain-text fallback. */
export function renderEmail(blocks: EmailBlock[], ctx: RenderContext): { html: string; textBody: string } {
  const text: string[] = [];
  const body = blocks.map((b) => renderBlock(b, ctx, text)).join("\n");
  // The style block overrides the canvas and card colours; brand tokens (and
  // the white card) remain the defaults. First style block wins.
  const style = blocks.find((b): b is Extract<EmailBlock, { type: "style" }> => b.type === "style");
  const bgValue = style?.backgroundColor;
  const cardValue = style?.cardColor;
  const canvas = isHexColor(bgValue) ? bgValue : ctx.brand.backgroundColor;
  const card = isHexColor(cardValue) ? cardValue : "#ffffff";
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title></title></head>
<body style="margin:0;padding:0;background:${canvas};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${canvas};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${card};border-radius:12px;">
${body}
</table>
</td></tr></table>
<img src="${esc(ctx.urls.open)}" width="1" height="1" alt="" style="display:block;" />
</body></html>`;
  return { html, textBody: text.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

export type ValidationIssue = { level: "error" | "warning"; message: string; blockId?: string };

/** The checks the editor shows and the send path enforces. */
export function validateBlocks(blocks: EmailBlock[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!blocks.length) issues.push({ level: "error", message: "The email is empty." });
  if (!blocks.some((b) => b.type === "footer")) {
    issues.push({ level: "error", message: "Add a footer block: every email must carry an unsubscribe link." });
  }
  if (blocks.filter((b) => b.type === "style").length > 1) {
    issues.push({ level: "warning", message: "More than one email style entry; only the first applies." });
  }
  // The same per-block checks run at the top level and inside column halves,
  // so a broken image or button cannot hide inside a column.
  const checkBlock = (b: EmailBlock, ownerId: string) => {
    if (b.type === "image" && !b.alt?.trim()) issues.push({ level: "warning", message: "Image has no alt text.", blockId: ownerId });
    if (b.type === "image" && !/^https?:\/\//.test(b.url ?? "")) issues.push({ level: "error", message: "Image has no valid URL.", blockId: ownerId });
    if (b.type === "button" && !/^(https?:\/\/|\{\{)/.test(b.href ?? "")) issues.push({ level: "error", message: `Button "${b.label}" has no valid link.`, blockId: ownerId });
    if (b.type === "menu" && b.links.some((l) => !/^https?:\/\//.test(l.url))) issues.push({ level: "warning", message: "A menu link is not a full URL.", blockId: ownerId });
    if (b.type === "heading" && !b.text?.trim()) issues.push({ level: "warning", message: "Heading is empty.", blockId: ownerId });
  };
  for (const b of blocks) {
    checkBlock(b, b.id);
    if (b.type === "columns") {
      for (const nested of [...(b.leftBlocks ?? []), ...(b.rightBlocks ?? [])]) {
        if (nested.type === "columns") issues.push({ level: "error", message: "Columns cannot be nested inside columns.", blockId: b.id });
        else checkBlock(nested, b.id);
      }
    }
  }
  return issues;
}

/**
 * Top-level blocks plus every block nested inside column halves, so lookups
 * (products, coupons, globals, polls) see the whole email in one pass.
 */
export function flattenBlocks(blocks: EmailBlock[]): EmailBlock[] {
  const out: EmailBlock[] = [];
  for (const b of blocks) {
    out.push(b);
    if (b.type === "columns") {
      for (const side of [b.leftBlocks, b.rightBlocks]) if (side?.length) out.push(...side);
    }
  }
  return out;
}

let counter = 0;
export const newBlockId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Starter content for "start from blank" — the minimum honest email. */
export function blankTemplate(): EmailBlock[] {
  return [
    { id: newBlockId(), type: "logo" },
    { id: newBlockId(), type: "heading", text: "Hello {{first_name}}", level: 1 },
    { id: newBlockId(), type: "text", html: "<p>Write your message here.</p>" },
    { id: newBlockId(), type: "button", label: "Shop now", href: "https://example.com" },
    { id: newBlockId(), type: "footer" },
  ];
}

export function parseBlocks(json: string | null | undefined): EmailBlock[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as EmailBlock[]) : [];
  } catch {
    return [];
  }
}
