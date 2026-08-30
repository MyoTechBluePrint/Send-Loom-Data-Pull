// Role permission map. Staging-grade RBAC: enforced at the sensitive seams
// (admin actions, feedback triage, demo reset, live sending) rather than on
// every read. What stays staging-only: full per-route enforcement, workspace
// isolation beyond the single demo workspace, and API-key scoping.
import { cookies } from "next/headers";
import { db } from "./db";
import { verifySessionToken, SESSION_COOKIE } from "./auth";

export type Role = "owner" | "full_access" | "admin" | "operator" | "ads_operator" | "marketing" | "editor" | "viewer";

export type Action =
  | "view_app"
  | "manage_demo_data"      // add/edit demo contacts, tasks, audiences, drafts
  | "review_intake"
  | "submit_feedback"
  | "triage_feedback"       // change status, notes, convert to task
  | "view_admin"
  | "download_plugin"        // plugin ZIP download (owner + admin)
  | "reset_demo_data"
  | "manage_users"
  | "enable_live_sending"
  | "change_billing"
  // Soft-delete campaigns, workflows and other test records from the working
  // interface. Deletion never erases performance history — it archives the
  // record out of sight and writes a DeletionRecord — so this is a working
  // permission, not a destructive one.
  | "delete_records"
  // See deleted records, the deletion ledger, and restore. The oversight
  // permission: whoever holds it can always answer "what was removed, by
  // whom, and what were its numbers".
  | "view_deleted";

const GRANTS: Record<Role, Set<Action>> = {
  owner: new Set(["view_app", "manage_demo_data", "review_intake", "submit_feedback", "triage_feedback", "view_admin", "download_plugin", "reset_demo_data", "manage_users", "enable_live_sending", "change_billing", "delete_records", "view_deleted"]),
  // Full Access: every capability the owner has, under its own name so it can
  // be tuned separately later without touching the owner role.
  full_access: new Set(["view_app", "manage_demo_data", "review_intake", "submit_feedback", "triage_feedback", "view_admin", "download_plugin", "reset_demo_data", "manage_users", "enable_live_sending", "change_billing", "delete_records", "view_deleted"]),
  admin: new Set(["view_app", "manage_demo_data", "review_intake", "submit_feedback", "triage_feedback", "view_admin", "download_plugin", "reset_demo_data", "delete_records", "view_deleted"]),
  operator: new Set(["view_app", "manage_demo_data", "review_intake", "submit_feedback", "view_admin", "delete_records"]),
  ads_operator: new Set(["view_app", "manage_demo_data", "review_intake", "submit_feedback", "delete_records"]),
  marketing: new Set(["view_app", "manage_demo_data", "review_intake", "submit_feedback", "delete_records"]),
  editor: new Set(["view_app", "manage_demo_data", "submit_feedback"]),
  viewer: new Set(["view_app", "submit_feedback"]),
};

export function can(role: string, action: Action): boolean {
  return GRANTS[(role as Role) in GRANTS ? (role as Role) : "viewer"].has(action);
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", full_access: "Full Access", admin: "Admin", operator: "Worker Admin · Operator", ads_operator: "Ads Operator",
  marketing: "Marketing Manager", editor: "Content Editor", viewer: "Viewer",
};

// Server-side current user from the session cookie (server components + routes).
export async function currentUser() {
  const jar = await cookies();
  const email = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!email) return null;
  const user = await db.user.findUnique({ where: { email } });
  return user && !user.disabled ? user : null;
}
