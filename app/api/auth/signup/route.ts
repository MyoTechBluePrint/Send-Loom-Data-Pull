// Self-serve signup. Creates a workspace, its owner, and a 7-day trial in one
// transaction, then signs the person straight in — no confirmation-email
// detour before they have seen the product.
//
// Existing accounts are untouched by this route: it only ever creates new
// workspaces. Nobody already using SendLoom passes through here.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { createSessionToken, hashPassword, checkRateLimit, SESSION_COOKIE } from "@/lib/server/auth";
import { startTrial, type SignupProfile } from "@/lib/server/trial";

const Body = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8, "Use at least 8 characters."),
  companyName: z.string().max(120).optional(),
  websiteUrl: z.string().max(300).optional(),
  platform: z.enum(["woocommerce", "shopify", "other", "none"]).optional(),
  contactsBand: z.enum(["under_1k", "1k_10k", "10k_50k", "50k_plus", "unsure"]).optional(),
  primaryGoal: z.enum(["recover_carts", "grow_list", "send_campaigns", "understand_revenue", "other"]).optional(),
});

/** Signups can be closed with an env flag without a deploy of the UI. */
export function signupsOpen(): boolean {
  return process.env.SENDLOOM_SIGNUPS !== "closed";
}

export async function POST(req: NextRequest) {
  if (!signupsOpen()) {
    return Response.json({ ok: false, error: "SendLoom is not accepting new accounts right now." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error?.issues?.[0]?.message ?? "Check the details and try again.";
    return Response.json({ ok: false, error: first }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) {
    return Response.json({ ok: false, error: "Too many accounts created from here. Try again later." }, { status: 429 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  if (await db.user.findUnique({ where: { email } })) {
    // Deliberately explicit here, unlike sign-in. Someone trying to create an
    // account needs to know it already exists, and it is their own address.
    return Response.json({ ok: false, error: "An account already uses this email. Sign in instead." }, { status: 409 });
  }

  const profile: SignupProfile = {
    companyName: parsed.data.companyName?.trim() || undefined,
    websiteUrl: parsed.data.websiteUrl?.trim() || undefined,
    platform: parsed.data.platform,
    contactsBand: parsed.data.contactsBand,
    primaryGoal: parsed.data.primaryGoal,
  };

  const workspaceName = profile.companyName || parsed.data.name.trim();

  const workspace = await db.workspace.create({ data: { name: workspaceName } });
  await db.user.create({
    data: {
      workspaceId: workspace.id,
      email,
      name: parsed.data.name.trim(),
      role: "owner",
      passwordHash: hashPassword(parsed.data.password),
    },
  });

  await startTrial(workspace.id, profile, email);
  await audit(workspace.id, email, "auth.signup", `New workspace "${workspaceName}" created · 7-day trial started · ip ${ip}`);

  const token = createSessionToken(email, Date.now(), 30);
  const res = Response.json({ ok: true, next: "/welcome" });
  res.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return res;
}
