import Link from "next/link";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, Badge } from "@/components/ui";
import { automations, gbp, num } from "@/lib/data";

export default function AutomationsPage() {
  return (
    <Shell
      title="Automations"
      subtitle="Always-on workflows triggered by store and email behaviour"
      actions={<PrimaryButton>New automation</PrimaryButton>}
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {automations.map((a) => (
          <Link key={a.id} href={`/automations/${a.id}`}>
            <Card className="h-full px-5 py-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{a.name}</h2>
                  <p className="mt-0.5 text-xs text-ink-3">Trigger: {a.trigger}</p>
                </div>
                <Badge value={a.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
                <div>
                  <p className="text-[11px] font-medium text-ink-3">Entered</p>
                  <p className="tabular mt-0.5 text-sm font-semibold">{num(a.entered)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-ink-3">Conversion</p>
                  <p className="tabular mt-0.5 text-sm font-semibold">{a.conversion}%</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-ink-3">Revenue</p>
                  <p className="tabular mt-0.5 text-sm font-semibold text-emerald-700">{gbp(a.revenue)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1">
                {a.nodes.slice(0, 6).map((n, i) => (
                  <span key={n.id} className="flex items-center gap-1">
                    {i > 0 && <span className="text-[10px] text-ink-3">→</span>}
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      n.kind === "trigger" ? "bg-violet-100 text-violet-700"
                      : n.kind === "email" ? "bg-blue-50 text-blue-700"
                      : n.kind === "condition" ? "bg-amber-50 text-amber-700"
                      : "bg-zinc-100 text-zinc-600"
                    }`}>
                      {n.kind === "trigger" ? "⚡" : n.kind === "email" ? "✉" : n.kind === "delay" ? "◷" : n.kind === "condition" ? "?" : "⏹"}
                    </span>
                  </span>
                ))}
                {a.branches && <span className="ml-1 text-[10px] font-medium text-ink-3">+ branch</span>}
              </div>
            </Card>
          </Link>
        ))}

        <Card className="flex h-full min-h-44 flex-col items-center justify-center border-dashed px-5 py-4 text-center">
          <p className="text-sm font-semibold text-ink-2">Start from a recipe</p>
          <p className="mt-1 max-w-52 text-xs text-ink-3">Win-back 180d, birthday, back-in-stock, price drop, shipping updates…</p>
          <button className="mt-3 rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand">Browse recipes</button>
        </Card>
      </div>
    </Shell>
  );
}
