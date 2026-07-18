import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, GhostButton, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Badge, Stat } from "@/components/ui";
import { gbp, num } from "@/lib/data";
import { getAutomationsView } from "@/lib/server/views";

export const dynamic = "force-dynamic";

const nodeChrome: Record<string, { border: string; chip: string; icon: string }> = {
  trigger: { border: "border-violet-300", chip: "bg-violet-100 text-violet-700", icon: "⚡" },
  email: { border: "border-blue-200", chip: "bg-blue-50 text-blue-700", icon: "✉" },
  delay: { border: "border-line", chip: "bg-zinc-100 text-zinc-600", icon: "◷" },
  condition: { border: "border-amber-300", chip: "bg-amber-50 text-amber-700", icon: "?" },
  task: { border: "border-emerald-300", chip: "bg-emerald-50 text-emerald-700", icon: "☑" },
  exit: { border: "border-line", chip: "bg-zinc-100 text-zinc-600", icon: "⏹" },
};

function Node({ n }: { n: { kind: string; label: string; detail: string; stats?: string } }) {
  const c = nodeChrome[n.kind] ?? nodeChrome.exit;
  return (
    <div className={`w-72 rounded-xl border-2 bg-surface px-4 py-3 text-left shadow-sm ${c.border}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${c.chip}`}>{c.icon}</span>
        <p className="text-[13px] font-semibold">{n.label}</p>
      </div>
      {n.detail && <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{n.detail}</p>}
      {n.stats && <p className="mt-1.5 border-t border-line pt-1.5 text-[11px] font-medium text-emerald-700">{n.stats}</p>}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-0.5">
      <div className="h-5 w-px bg-[#c3c2b7]" />
      <div className="-mt-1 text-[10px] text-[#898781]">▼</div>
    </div>
  );
}

export default async function AutomationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auto = (await getAutomationsView()).find((a) => a.id === id);
  if (!auto) notFound();
  const isTemplate = auto.status === "draft" && auto.isDemo;

  return (
    <Shell
      title={auto.name}
      subtitle={`Trigger: ${auto.trigger}`}
      actions={
        <>
          <GhostButton>{auto.status === "live" ? "Pause" : "Configure"}</GhostButton>
          <PrimaryButton>Edit workflow</PrimaryButton>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/automations" className="text-xs font-semibold text-brand hover:underline">← All automations</Link>
        {isTemplate
          ? <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-zinc-600">Template · no live sends yet</span>
          : <Badge value={auto.status} />}
      </div>

      {isTemplate ? (
        <Card className="mt-3 border-amber-200 bg-amber-50/50 px-5 py-3.5">
          <p className="text-sm text-amber-900">
            Ready to configure once MyoTech/Novatec tracking is connected. Activation requires store events and (for sends) the sending provider.
          </p>
        </Card>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat label="Contacts entered" value={num(auto.entered)} />
          <Stat label="Completed" value={num(auto.completed)} />
          <Stat label="Conversion rate" value={`${auto.conversion}%`} />
          <Stat label="Attributed revenue" value={gbp(auto.revenue)} />
        </div>
      )}

      <Card className="mt-4 overflow-x-auto bg-[repeating-linear-gradient(0deg,transparent,transparent_23px,#f0efec_24px),repeating-linear-gradient(90deg,transparent,transparent_23px,#f0efec_24px)] px-6 py-8">
        <div className="flex flex-col items-center">
          {auto.nodes.map((n, i) => (
            <div key={n.id} className="flex flex-col items-center">
              {i > 0 && <Connector />}
              <Node n={n} />
            </div>
          ))}
          {auto.branches && (
            <div className="mt-1 flex w-full max-w-2xl flex-col items-center gap-6 pt-2 md:flex-row md:items-start md:justify-center md:gap-10">
              <div className="flex flex-1 flex-col items-center">
                <span className="mb-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">YES</span>
                {auto.branches.yes.map((n, i) => (
                  <div key={n.id} className="flex flex-col items-center">{i > 0 && <Connector />}<Node n={n} /></div>
                ))}
              </div>
              <div className="flex flex-1 flex-col items-center">
                <span className="mb-1 rounded-full bg-zinc-200 px-2.5 py-0.5 text-[11px] font-bold text-zinc-600">NO</span>
                {auto.branches.no.map((n, i) => (
                  <div key={n.id} className="flex flex-col items-center">{i > 0 && <Connector />}<Node n={n} /></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </Shell>
  );
}
