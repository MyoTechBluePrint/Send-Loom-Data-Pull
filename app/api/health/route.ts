// Simple unauthenticated health alias (the store API health check lives at
// /api/v1/health).
export async function GET() {
  return Response.json({ ok: true, service: "sendloom", env: "staging-demo" });
}
