// GET /api/v1/ping — key check. Any active key, no specific permission.
import { NextRequest } from "next/server";
import { requireApiKey, ok } from "@/lib/server/platform";

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req, null);
  if (auth instanceof Response) return auth;
  return ok(
    { integration: auth.integrationSlug, environment: "live", permissions: auth.permissions },
    auth.requestId
  );
}
