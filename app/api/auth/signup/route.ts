// Self-serve signup. Creates a workspace, its owner, and a 7-day trial in one
// step, then signs the person straight in — no confirmation-email detour
// before they have seen the product. (The platform has no email-verification
// flow today, so none is invented here.)
//
// The form asks only what the brief allows at this stage: name, work email,
// password, business name, terms. The commercial questions come after the
// account exists, at /onboarding/business, and are skippable.
//
// Existing accounts are untouched by this route: it only ever creates new
// workspaces, and every workspace it creates is accountType "external".
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { createSessionToken, hashPassword, checkRateLimit, SESSION_COOKIE } from "@/lib/server/auth";
import { startTrial } from "@/lib/server/trial";
import { trackFunnel } from "@/lib/server/billing/analytics-events";

const Body = z.object({
  firstName: z.string().min(1, "Enter your first name.").max(60),
  lastName: z.string().min(1, "Enter your last name.").max(60),
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
  companyName: z.string().min(1, "Enter your business or brand name.").max(120),
  websiteUrl: z.string().max(300).optional(),
  acceptTerms: z.literal(true, { error: "Please accept the terms and privacy policy." }),
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
    // Deliberately explicit here, unlike sign-in: someone trying to create an
    // account needs to know it already exists, and it is their own address.
    return Response.json({ ok: false, error: "An account already uses this email. Sign in instead." }, { status: 409 });
  }

  await trackFunnel("signup_started", { email, payload: { ip } });

  const workspaceName = parsed.data.companyName.trim();
  const fullName = `${parsed.data.firstName.trim()} ${parsed.data.lastName.trim()}`;

  const workspace = await db.workspace.create({ data: { name: workspaceName } });
  await db.user.create({
    data: {
      workspaceId: workspace.id,
      email,
      name: fullName,
      role: "owner",
      passwordHash: hashPassword(parsed.data.password),
      termsAcceptedAt: new Date(),
    },
  });

  await startTrial(
    workspace.id,
    { companyName: workspaceName, websiteUrl: parsed.data.websiteUrl?.trim() || undefined },
    email
  );

  await trackFunnel("signup_completed", { workspaceId: workspace.id, email, once: true });
  await audit(workspace.id, email, "auth.signup", `New workspace "${workspaceName}" created · terms accepted · 7-day trial started · ip ${ip}`);

  const token = createSessionToken(email, Date.now(), 30);
  const res = Response.json({ ok: true, next: "/onboarding/trial" });
  res.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return res;
}
