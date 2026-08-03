// Brand kits: list, create, update. A brand is the identity a campaign or
// form is dressed in — MyoTech and Novatec live side by side in one
// workspace without sharing a logo, sender or product source.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";

const Links = z.array(z.object({ label: z.string().max(60), url: z.string().max(300) })).max(12);

// Forms submit untouched fields as "" — that must read as "not set", never as
// an invalid value. This was the "Save brand does nothing" bug: an empty
// sender email failed z.email() and 400'd every save.
const blankToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema);

const Upsert = z.object({
  id: z.string().optional(), // present = update
  name: z.string().min(1).max(80),
  websiteUrl: blankToNull(z.string().max(300).nullable()).optional(),
  storeId: blankToNull(z.string().nullable()).optional(),
  logoUrl: blankToNull(z.string().max(500).nullable()).optional(),
  darkLogoUrl: blankToNull(z.string().max(500).nullable()).optional(),
  iconUrl: blankToNull(z.string().max(500).nullable()).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "use a full hex colour like #6d28d9").optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "use a full hex colour like #6d28d9").optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "use a full hex colour like #6d28d9").optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "use a full hex colour like #6d28d9").optional(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "use a full hex colour like #6d28d9").optional(),
  headingFont: z.string().max(200).optional(),
  bodyFont: z.string().max(200).optional(),
  buttonRadius: z.number().int().min(0).max(32).optional(),
  socialLinks: Links.optional(),
  menuLinks: Links.optional(),
  legalLinks: Links.optional(),
  contactDetails: blankToNull(z.string().max(300).nullable()).optional(),
  mailingAddress: blankToNull(z.string().max(300).nullable()).optional(),
  senderName: blankToNull(z.string().max(120).nullable()).optional(),
  senderEmail: blankToNull(z.string().email().nullable()).optional(),
  replyToEmail: blankToNull(z.string().email().nullable()).optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().max(10).optional(),
  footerText: blankToNull(z.string().max(500).nullable()).optional(),
  unsubscribeText: z.string().max(300).optional(),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const [brands, stores] = await Promise.all([
    db.brand.findMany({
      where: { workspaceId: user.workspaceId },
      include: { _count: { select: { templates: true, elements: true } } },
      orderBy: { name: "asc" },
    }),
    db.store.findMany({ where: { workspaceId: user.workspaceId }, select: { id: true, name: true } }),
  ]);

  return Response.json({
    ok: true,
    stores,
    brands: brands.map((b) => ({
      ...b,
      socialLinks: b.socialLinks, menuLinks: b.menuLinks, legalLinks: b.legalLinks,
      templates: b._count.templates,
      elements: b._count.elements,
      storeName: stores.find((s) => s.id === b.storeId)?.name ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const parsed = Upsert.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.filter((p) => typeof p === "string").join(".") ?? "";
    const msg = issue ? `${field ? field + ": " : ""}${issue.message}` : "Check the brand details.";
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
  const { id, socialLinks, menuLinks, legalLinks, storeId, ...rest } = parsed.data;

  // A brand may only point at a store in its own workspace.
  if (storeId) {
    const store = await db.store.findFirst({ where: { id: storeId, workspaceId: user.workspaceId } });
    if (!store) return Response.json({ ok: false, error: "That store is not in this workspace." }, { status: 400 });
  }

  const data = {
    ...rest,
    storeId: storeId ?? null,
    socialLinks: socialLinks ? JSON.stringify(socialLinks) : undefined,
    menuLinks: menuLinks ? JSON.stringify(menuLinks) : undefined,
    legalLinks: legalLinks ? JSON.stringify(legalLinks) : undefined,
  };

  if (id) {
    const owned = await db.brand.findFirst({ where: { id, workspaceId: user.workspaceId } });
    if (!owned) return Response.json({ ok: false, error: "Brand not found." }, { status: 404 });
    const brand = await db.brand.update({ where: { id }, data });
    await audit(user.workspaceId, user.email, "brand.updated", `'${brand.name}'`);
    return Response.json({ ok: true, id: brand.id });
  }

  const existing = await db.brand.findUnique({ where: { workspaceId_name: { workspaceId: user.workspaceId, name: parsed.data.name } } });
  if (existing) return Response.json({ ok: false, error: "A brand with this name already exists." }, { status: 409 });

  const brand = await db.brand.create({ data: { workspaceId: user.workspaceId, ...data } });
  await audit(user.workspaceId, user.email, "brand.created", `'${brand.name}'`);
  return Response.json({ ok: true, id: brand.id });
}
