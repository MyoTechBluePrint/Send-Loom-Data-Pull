// Saves the post-signup onboarding answers. Every field is optional because
// every question is skippable; whatever arrives is persisted onto the
// subscription, where the plan recommendation reads it back.
import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/server/permissions";
import { saveOnboardingProfile, recommendPlan } from "@/lib/server/trial";
import { isComplimentaryWorkspace } from "@/lib/server/billing/subscription-context";

const Body = z.object({
  businessType: z.enum(["ecommerce", "professional_services", "hospitality", "property", "financial_services", "agency", "creator_media", "other"]).optional(),
  expectedContacts: z.number().int().min(0).max(100_000_000).optional(),
  expectedSends: z.number().int().min(0).max(1_000_000_000).optional(),
  expectedSites: z.number().int().min(0).max(1000).optional(),
  primaryGoal: z.enum(["generate_sales", "recover_carts", "build_journeys", "grow_list", "improve_retention", "send_newsletters", "manage_clients"]).optional(),
  websiteUrl: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  if (await isComplimentaryWorkspace(user.workspaceId)) {
    return Response.json({ ok: false, error: "This account is not on a trial." }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Check the answers and try again." }, { status: 400 });

  await saveOnboardingProfile(user.workspaceId, parsed.data, user.email);
  const recommendation = await recommendPlan(user.workspaceId);

  return Response.json({ ok: true, recommendation });
}
