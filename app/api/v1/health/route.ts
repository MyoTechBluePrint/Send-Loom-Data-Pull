import { NextRequest } from "next/server";
import { authenticateStore } from "@/lib/server/apiAuth";

const BOOTED_AT = new Date().toISOString();

export async function GET(req: NextRequest) {
  const store = await authenticateStore(req);
  return Response.json({
    ok: true,
    service: "sendloom",
    version: "3.0.0",
    // Ground truth for "is the deploy actually serving": Render injects the
    // commit it built. Anyone can compare this against git; nobody has to
    // guess from behaviour again.
    build: process.env.RENDER_GIT_COMMIT?.slice(0, 12) ?? "local",
    startedAt: BOOTED_AT,
    emailProvider: process.env.EMAIL_SENDING_ENABLED === "true" &&
      (process.env.RESEND_API_KEY || process.env.AWS_ACCESS_KEY_ID)
        ? "live"
        : "dev-log (no real sending)",
    authenticated: !!store,
    store: store ? { id: store.id, name: store.name, status: store.status, lastSyncAt: store.lastSyncAt } : null,
  });
}
