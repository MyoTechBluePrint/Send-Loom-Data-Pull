// Admin: subscriptions, plans and commercial analytics.

import { Shell } from "@/components/shell";
import { Card } from "@/components/ui";
import { can, currentUser } from "@/lib/server/permissions";
import { AdminSubscriptionsClient } from "@/components/admin-subscriptions-client";
import { SubscriptionAnalytics } from "@/components/admin-subscription-analytics";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const user = await currentUser();
  const role = user?.role ?? "viewer";

  if (!can(role, "view_admin")) {
    return (
      <Shell title="Subscriptions" subtitle="Billing administration">
        <Card className="px-5 py-8 text-center text-sm text-ink-3">
          Subscription administration is available to owner, admin and operator accounts. Your role: {role}.
        </Card>
      </Shell>
    );
  }

  return (
    <Shell title="Subscriptions" subtitle="Accounts, plans, conversion and revenue">
      <div className="space-y-4">
        <SubscriptionAnalytics />
        <AdminSubscriptionsClient canChange={can(role, "change_billing")} />
      </div>
    </Shell>
  );
}
