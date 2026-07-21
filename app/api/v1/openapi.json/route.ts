// GET /api/v1/openapi.json — the generated OpenAPI 3.1 document. Public:
// it describes the API and contains no secrets.
import { NextRequest } from "next/server";
import { buildOpenApi } from "@/lib/server/platform-spec";

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "sendloom.onrender.com";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return Response.json(buildOpenApi(`${proto}://${host.split(",")[0].trim()}`), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
