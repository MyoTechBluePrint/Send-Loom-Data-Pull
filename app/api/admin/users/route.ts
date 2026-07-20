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

const PatchBody = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "full_access", "admin", "operator", "ads_operator", "marketing", "editor", "viewer"]).optional(),
  disabled: z.boolean().optional(),
});

// Role changes and disable/enable. Protections: you cannot demote or disable
// yourself, and the workspace can never lose its last active owner.
export async function PATCH(req: NextRequest) {
  const actor = await currentUser();
  if (!actor || !can(actor.role, "manage_users")) {
    return Response.json({ ok: false, error: "Owner access required." }, { status: 403 });
  }
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (parsed.data.role === undefined && parsed.data.disabled === undefined)) {
    return Response.json({ ok: false, error: "Provide a role and/or disabled flag." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const target = await db.user.findUnique({ where: { email } });
  if (!target) return Response.json({ ok: false, error: "No user with that email." }, { status: 404 });

  if (target.email === actor.email && (parsed.data.disabled === true || (parsed.data.role && parsed.data.role !== actor.role))) {
    return Response.json({ ok: false, error: "You cannot demote or disable your own account." }, { status: 400 });
  }
  const losingOwner = target.role === "owner" && (parsed.data.disabled === true || (parsed.data.role && parsed.data.role !== "owner"));
  if (losingOwner) {
    const otherOwners = await db.user.count({ where: { role: "owner", disabled: false, email: { not: email } } });
    if (otherOwners === 0) {
      return Response.json({ ok: false, error: "The workspace must keep at least one active owner." }, { status: 400 });
    }
  }

  const updated = await db.user.update({
    where: { email },
    data: {
      ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
      ...(parsed.data.disabled !== undefined ? { disabled: parsed.data.disabled } : {}),
    },
  });

  await audit(updated.workspaceId, actor.email, "user.updated",
    `${email}: ${parsed.data.role !== undefined ? `role → ${ROLE_LABELS[parsed.data.role] ?? parsed.data.role}` : ""}${parsed.data.role !== undefined && parsed.data.disabled !== undefined ? " · " : ""}${parsed.data.disabled !== undefined ? (parsed.data.disabled ? "account DISABLED" : "account re-enabled") : ""}`);

  return Response.json({ ok: true, user: { email: updated.email, role: updated.role, disabled: updated.disabled } });
}
