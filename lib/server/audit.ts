import { db } from "./db";

export function audit(workspaceId: string, actorLabel: string, action: string, detail?: string) {
  return db.auditLog.create({ data: { workspaceId, actorLabel, action, detail } });
}
