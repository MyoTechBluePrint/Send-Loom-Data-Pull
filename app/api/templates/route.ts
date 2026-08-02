// Template library: list and create. Workspace-scoped throughout — templates
// never leak between workspaces, so MyoTech's designs are invisible to any
// external SendLoom customer.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";
import { blankTemplate, parseBlocks, validateBlocks } from "@/lib/server/email-blocks";

export const CATEGORIES = [
  "welcome", "product_launch", "abandoned_basket", "discount", "newsletter",
  "educational", "re_engagement", "post_purchase", "review_request", "survey",
  "vip", "seasonal",
] as const;

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const archived = q.get("archived") === "1";
  const category = q.get("category");
  const brandId = q.get("brand");
  const search = q.get("q")?.toLowerCase();

  const templates = await db.emailTemplate.findMany({
    where: {
      workspaceId: user.workspaceId,
      archived,
      ...(category ? { category } : {}),
      ...(brandId ? { brandId } : {}),
    },
    include: { brand: { select: { name: true } }, _count: { select: { campaigns: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const rows = templates
    .filter((t) => !search || t.name.toLowerCase().includes(search))
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      brandId: t.brandId,
      brandName: t.brand?.name ?? null,
      archived: t.archived,
      blockCount: parseBlocks(t.content).length,
      usedByCampaigns: t._count.campaigns,
      updatedAt: t.updatedAt.toISOString(),
      updatedBy: t.updatedBy,
    }));

  return Response.json({ ok: true, templates: rows, categories: CATEGORIES });
}

const Create = z.object({
  name: z.string().min(1).max(120),
  category: z.string().max(40).default("newsletter"),
  description: z.string().max(300).optional(),
  brandId: z.string().optional(),
  /** Omitted = start from blank. */
  content: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Give the template a name." }, { status: 400 });

  const blocks = parsed.data.content ? parseBlocks(parsed.data.content) : blankTemplate();

  const template = await db.emailTemplate.create({
    data: {
      workspaceId: user.workspaceId,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description ?? null,
      brandId: parsed.data.brandId ?? null,
      content: JSON.stringify(blocks),
      updatedBy: user.email,
    },
  });

  await audit(user.workspaceId, user.email, "template.created", `'${template.name}' (${template.category})`);
  return Response.json({ ok: true, id: template.id, issues: validateBlocks(blocks) });
}
