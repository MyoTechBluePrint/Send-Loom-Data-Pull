// Role permission map. Staging-grade RBAC: enforced at the sensitive seams
// (admin actions, feedback triage, demo reset, live sending) rather than on
// every read. What stays staging-only: full per-route enforcement, workspace
// isolation beyond the single demo workspace, and API-key scoping.
import { cookies } from "next/headers";
import { db } from "./db";
import { verifySessionToken, SESSION_COOKIE } from "./auth";

export type Role = "owner" | "admin" | "operator" | "marketing" | "editor" | "viewer";

export type Action =
  | "view_app"
  | "manage_demo_data"      // add/edit demo contacts, tasks, audiences, drafts
  | "review_intake"
  | "submit_feedback"
  | "triage_feedback"       // change status, notes, convert to task
  | "view_admin"
  | "reset_demo_data"
  | "manage_users"
  | "enable_live_sending"
  | "change_billing";

const GRANTS: Record<Role, Set<Action>> = {
  owner: new Set(["view_app", "manage_demo_data", "review_intake", "submit_feedback", "triage_feedback", "view_admin", "reset_demo_data", "manage_users", "enable_live_sending", "change_billing"]),
  admin: new Set(["view_app", "manage_demo_data", "review_intake", "submit_feedback", "triage_feedback", "view_admin", "reset_demo_data"]),
  operator: new Set(["view_app", "manage_demo_data", "review_intake", "submit_feedback", "view_admin"]),
  marketing: new Set(["view_app", "manage_demo_data", "review_intake", "submit_feedback"]),
  editor: new Set(["view_app", "manage_demo_data", "submit_feedback"]),
  viewer: new Set(["view_app", "submit_feedback"]),
};

export function can(role: string, action: Action): boolean {
  return GRANTS[(role as Role) in GRANTS ? (role as Role) : "viewer"].has(action);
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", admin: "Admin", operator: "Worker Admin · Operator",
  marketing: "Marketing Manager", editor: "Content Editor", viewer: "Viewer",
};

// Server-side current user from the session cookie (server components + routes).
export async function currentUser() {
  const jar = await cookies();
  const email = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!email) return null;
  return db.user.findUnique({ where: { email } });
}
