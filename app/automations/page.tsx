import Link from "next/link";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, Badge } from "@/components/ui";
import { gbp, num } from "@/lib/data";
import { getAutomationsView } from "@/lib/server/views";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const automations = await getAutomationsView();
  const templatesOnly = automations.every((a) => a.status === "draft");

  return (
    <Shell
      title="Automations"
      subtitle={templatesOnly ? "Recipe templates · ready to configure once MyoTech/Novatec tracking is connected" : "Always-on workflows triggered by store and email behaviour"}
      actions={<PrimaryButton>New automation</PrimaryButton>}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {automations.map((a) => (
          <Link key={a.id} href={`/automations/${a.id}`}>
            <Card className="h-full px-5 py-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{a.name}</h2>
                  <p className="mt-0.5 text-xs text-ink-3">Trigger: {a.trigger}</p>
                </div>
                {a.status === "draft" && a.isDemo
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
                  No live sends yet · connect store tracking before activation.
                </p>
              )}
            </Card>
          </Link>
        ))}
        {automations.length === 0 && (
          <Card className="col-span-full px-5 py-10 text-center text-sm text-ink-3">
            No automations yet. Recipes appear here after the workspace seed.
          </Card>
        )}
      </div>
    </Shell>
  );
}
