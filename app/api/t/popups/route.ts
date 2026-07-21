// PUBLIC popup config for a store's tracker. Returns only live popup-type
// forms; the browser gets display config, never anything sensitive. The
// tracker HTML-escapes everything it renders.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";

export async function GET(req: NextRequest) {
  const publicId = req.nextUrl.searchParams.get("store");
  const headers = {
    "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
    "Cache-Control": "public, max-age=300",
    "Vary": "Origin",
  };
  if (!publicId) return Response.json({ ok: false }, { status: 400, headers });

  const store = await db.store.findUnique({ where: { publicId } });
  if (!store) return Response.json({ ok: false }, { status: 403, headers });

  const forms = await db.form.findMany({
    where: {
      workspaceId: store.workspaceId,
      status: "live",
      type: { in: ["popup", "exit_intent", "floating_bar"] },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return Response.json({
    ok: true,
    popups: forms.map((f) => {
      // Builder config first; clean defaults for legacy template rows.
      const kind = f.triggerKind && f.triggerKind !== "time_on_page"
        ? f.triggerKind
        : f.type === "exit_intent"
          ? "exit_intent"
          : f.triggerKind || "time_on_page";
      return {
        id: f.id,
        type: f.type,
        headline: f.headline || f.name,
        body: f.body || "Join for early access and honest product education. Unsubscribe anytime.",
        buttonLabel: f.buttonLabel || "Sign up",
        consentLabel: f.consentLabel || "Email me offers and updates (you can opt out anytime)",
        successMessage: f.successMessage || "Done — check your inbox soon.",
        offerCode: f.offerCode || null,
        accent: f.accent || "#6d28d9",
        collectName: f.collectName === true,
        trigger: kind === "exit_intent"
          ? { kind: "exit_intent" }
          : kind === "scroll"
            ? { kind: "scroll" }
            : { kind: "time_on_page", seconds: f.triggerSeconds || 8 },
        oncePerVisitor: true,
      };
    }),
  }, { headers });
}
