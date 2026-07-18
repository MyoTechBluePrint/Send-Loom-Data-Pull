import { NextRequest } from "next/server";
import { db } from "./db";

export async function authenticateStore(req: NextRequest) {
  const key = req.headers.get("x-sendloom-key");
  if (!key) return null;
  return db.store.findUnique({ where: { apiKey: key } });
}

export function unauthorized() {
  return Response.json({ ok: false, error: "Invalid or missing x-sendloom-key" }, { status: 401 });
}
