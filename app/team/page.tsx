import { Shell } from "@/components/shell";
import { Card } from "@/components/ui";
import { db } from "@/lib/server/db";
import { can, currentUser, ROLE_LABELS } from "@/lib/server/permissions";
import { TeamClient } from "@/components/team-client";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await currentUser();
  const isOwner = can(user?.role ?? "viewer", "manage_users");

  if (!isOwner) {
    return (
      <Shell title="Team" subtitle="Logins and roles">
        <Card className="px-5 py-8 text-center text-sm text-ink-3">
          Team management is owner-only. Ask Steve to add or change logins.
        </Card>
      </Shell>
    );
  }

  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  const members = users.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role] ?? u.role,
    disabled: u.disabled,
    hasPassword: !!u.passwordHash,
    isYou: u.email === user?.email,
  }));

  return (
    <Shell
      title="Team"
      subtitle="Add logins, change roles, reset passwords and disable accounts · every change is audited"
    >
      <TeamClient members={members} />
    </Shell>
  );
}
