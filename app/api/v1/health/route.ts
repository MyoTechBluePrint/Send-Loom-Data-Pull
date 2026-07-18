import { NextRequest } from "next/server";
import { authenticateStore } from "@/lib/server/apiAuth";

export async function GET(req: NextRequest) {
  const store = await authenticateStore(req);
  return Response.json({
    ok: true,
    service: "sendloom",
    version: "3.0.0",
    authenticated: !!store,
    store: store ? { id: store.id, name: store.name, status: store.status, lastSyncAt: store.lastSyncAt } : null,
  });
}
