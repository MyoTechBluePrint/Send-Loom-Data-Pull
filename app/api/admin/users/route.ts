// Owner-only user provisioning. Creates or updates a login without touching
// the SEED_USERS env var. NOTE: a workspace reset re-seeds users from
// SEED_USERS only, so accounts created here disappear on reset unless they
// are also added to SEED_USERS in Render.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { hashPassword } from "@/lib/server/auth";
import { can, currentUser, ROLE_LABELS } from "@/lib/server/permissions";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80).optional(),
  role: z.enum(["owner", "full_access", "admin", "operator", "ads_operator", "marketing", "editor", "viewer"]),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || !can(user.role, "manage_users")) {
    return Response.json({ ok: false, error: "Owner access required." }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "email, password (min 8) and a valid role are required." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ws = await db.workspace.findFirstOrThrow();
  const name =
    parsed.data.name ??
    email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const created = await db.user.upsert({
    where: { email },
    create: { workspaceId: ws.id, email, name, role: parsed.data.role, passwordHash: hashPassword(parsed.data.password) },
    update: { name, role: parsed.data.role, passwordHash: hashPassword(parsed.data.password) },
  });

  await audit(ws.id, user.email, "user.provisioned",
    `${email} set up as ${ROLE_LABELS[parsed.data.role] ?? parsed.data.role} (password set; remember to mirror into SEED_USERS for reset-permanence)`);

  return Response.json({ ok: true, user: { email: created.email, name: created.name, role: created.role } });
}
