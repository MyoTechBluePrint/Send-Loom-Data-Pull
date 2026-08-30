import Link from "next/link";
import { Shell } from "@/components/shell";
import { AutomationCreate } from "@/components/automation-create";
import { Card, Badge } from "@/components/ui";
import { gbp, num } from "@/lib/data";
import { getAutomationsView } from "@/lib/server/views";
import { can, currentUser } from "@/lib/server/permissions";

export const dynamic = "force-dynamic";

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const user = await currentUser();
  const canSeeDeleted = can(user?.role ?? "viewer", "view_deleted");
  const deletedView = filter === "deleted" && canSeeDeleted;
  const automations = await getAutomationsView({ list: deletedView ? "deleted" : "working" });
  const templatesOnly = !deletedView && automations.every((a) => a.status === "draft");

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-[#ede9fe] text-brand" : "text-ink-3 hover:bg-[#f0efec] hover:text-ink-2"}`;

  return (
    <Shell
      title="Automations"
      subtitle={
        deletedView
          ? "Deleted workflows · their runs and sends remain in historical analytics"
          : templatesOnly
            ? "Recipe templates · ready to configure once MyoTech/Novatec tracking is connected"
            : "Always-on workflows triggered by store and email behaviour"
      }
      actions={<AutomationCreate />}
    >
      {canSeeDeleted && (
        <div className="mb-4 flex items-center gap-1.5">
          <Link href="/automations" className={chip(!deletedView)}>Working list</Link>
          <Link href="/automations?filter=deleted" className={chip(deletedView)}>Deleted</Link>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {automations.map((a) => (
          <Link key={a.id} href={`/automations/${a.id}`}>
            <Card className={`h-full px-5 py-4 transition-shadow hover:shadow-md ${a.deletedAt ? "opacity-75" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{a.name}</h2>
                  <p className="mt-0.5 text-xs text-ink-3">Trigger: {a.trigger}</p>
                </div>
                {a.deletedAt
                  ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600">Deleted</span>
                  : a.status === "draft" && a.isDemo
                    ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600">Template</span>
                    : <Badge value={a.status} />}
              </div>
              {a.entered > 0 ? (
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
                  <div><p className="text-[11px] font-medium text-ink-3">Entered</p><p className="tabular mt-0.5 text-sm font-semibold">{num(a.entered)}</p></div>
                  <div><p className="text-[11px] font-medium text-ink-3">Conversion</p><p className="tabular mt-0.5 text-sm font-semibold">{a.conversion}%</p></div>
                  <div><p className="text-[11px] font-medium text-ink-3">Revenue</p><p className="tabular mt-0.5 text-sm font-semibold text-emerald-700">{gbp(a.revenue)}</p></div>
                </div>
              ) : (
                <p className="mt-4 border-t border-line pt-3 text-xs text-ink-2">
                  {a.deletedAt
                    ? `Deleted ${a.deletedAt}${a.deletedBy ? ` by ${a.deletedBy}` : ""} · history retained`
                    : "No live sends yet · connect store tracking before activation."}
                </p>
              )}
              {a.deletedAt && a.entered > 0 && (
                <p className="mt-2 text-[11px] text-ink-3">Deleted {a.deletedAt}{a.deletedBy ? ` by ${a.deletedBy}` : ""} · these numbers stay in analytics</p>
              )}
            </Card>
          </Link>
        ))}
        {automations.length === 0 && (
          <Card className="col-span-full px-5 py-10 text-center text-sm text-ink-3">
            {deletedView
              ? "No deleted workflows. Deleting one moves it here — its performance history always stays in analytics."
              : "No automations yet. Recipes appear here after the workspace seed."}
          </Card>
        )}
      </div>
    </Shell>
  );
}
