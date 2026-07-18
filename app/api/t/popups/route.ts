// PUBLIC popup config for a store's tracker. Returns only live popup-type
// forms; the browser gets display config, never anything sensitive.
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
    take: 3,
  });

  return Response.json({
    ok: true,
    popups: forms.map((f) => ({
      id: f.id,
      type: f.type,
      // Display config. A full popup builder config lands later; this ships a
      // clean default template per popup type.
      headline: f.name.includes("offer") ? "Get 15% off your first order" : f.name,
      body: "Join for early access and honest product education. Unsubscribe anytime.",
      buttonLabel: "Claim my code",
      consentLabel: "Email me offers and updates (you can opt out anytime)",
      trigger: f.type === "exit_intent" ? { kind: "exit_intent" } : { kind: "time_on_page", seconds: 8 },
      oncePerVisitor: true,
    })),
  }, { headers });
}
