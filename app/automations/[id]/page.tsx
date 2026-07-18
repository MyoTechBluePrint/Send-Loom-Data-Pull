"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Shell, GhostButton, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Badge, Stat } from "@/components/ui";
import { automations, gbp, num, type AutomationNode } from "@/lib/data";

const nodeChrome: Record<AutomationNode["kind"], { border: string; chip: string; icon: string }> = {
  trigger: { border: "border-violet-300", chip: "bg-violet-100 text-violet-700", icon: "⚡" },
  email: { border: "border-blue-200", chip: "bg-blue-50 text-blue-700", icon: "✉" },
  delay: { border: "border-line", chip: "bg-zinc-100 text-zinc-600", icon: "◷" },
  condition: { border: "border-amber-300", chip: "bg-amber-50 text-amber-700", icon: "?" },
  split: { border: "border-amber-300", chip: "bg-amber-50 text-amber-700", icon: "⑂" },
  webhook: { border: "border-line", chip: "bg-zinc-100 text-zinc-600", icon: "↯" },
  exit: { border: "border-line", chip: "bg-zinc-100 text-zinc-600", icon: "⏹" },
};

function Node({ n, selected, onSelect }: { n: AutomationNode; selected: boolean; onSelect: () => void }) {
  const c = nodeChrome[n.kind];
  return (
    <button
      onClick={onSelect}
      className={`w-72 rounded-xl border-2 bg-surface px-4 py-3 text-left shadow-sm transition-all hover:shadow-md ${
        selected ? "border-brand ring-2 ring-brand-soft" : c.border
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${c.chip}`}>{c.icon}</span>
        <p className="text-[13px] font-semibold">{n.label}</p>
      </div>
      {n.detail && <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{n.detail}</p>}
      {n.stats && <p className="mt-1.5 border-t border-line pt-1.5 text-[11px] font-medium text-emerald-700">{n.stats}</p>}
    </button>
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

export default function AutomationCanvas() {
  const { id } = useParams<{ id: string }>();
  const auto = automations.find((a) => a.id === id) ?? automations[0];
  const [selected, setSelected] = useState<string | null>(null);
  const branchIdx = auto.branches ? auto.nodes.findIndex((n) => n.id === auto.branches!.at) : -1;
  const mainNodes = branchIdx >= 0 ? auto.nodes.slice(0, branchIdx + 1) : auto.nodes;
  const selectedNode =
    auto.nodes.find((n) => n.id === selected) ??
    auto.branches?.yes.find((n) => n.id === selected) ??
    auto.branches?.no.find((n) => n.id === selected) ??
    null;

  return (
    <Shell
      title={auto.name}
      subtitle={`Trigger: ${auto.trigger}`}
      actions={
        <>
          <GhostButton>{auto.status === "live" ? "Pause" : "Resume"}</GhostButton>
          <PrimaryButton>Edit workflow</PrimaryButton>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <Link href="/automations" className="text-xs font-semibold text-brand hover:underline">← All automations</Link>
        <Badge value={auto.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Contacts entered" value={num(auto.entered)} />
        <Stat label="Completed" value={num(auto.completed)} />
        <Stat label="Conversion rate" value={`${auto.conversion}%`} />
        <Stat label="Attributed revenue" value={gbp(auto.revenue)} />
      </div>

      <div className="mt-4 grid grid-cols-[1fr_300px] gap-4">
        <Card className="overflow-x-auto bg-[repeating-linear-gradient(0deg,transparent,transparent_23px,#f0efec_24px),repeating-linear-gradient(90deg,transparent,transparent_23px,#f0efec_24px)] px-6 py-8">
          <div className="flex flex-col items-center">
            {mainNodes.map((n, i) => (
              <div key={n.id} className="flex flex-col items-center">
                {i > 0 && <Connector />}
                <Node n={n} selected={selected === n.id} onSelect={() => setSelected(n.id)} />
              </div>
            ))}

            {auto.branches && (
              <>
                <div className="mt-1 flex w-full max-w-2xl items-start justify-center gap-10 pt-2">
                  <div className="flex flex-1 flex-col items-center">
                    <span className="mb-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">YES</span>
                    {auto.branches.yes.map((n, i) => (
                      <div key={n.id} className="flex flex-col items-center">
                        {i > 0 && <Connector />}
                        <Node n={n} selected={selected === n.id} onSelect={() => setSelected(n.id)} />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-1 flex-col items-center">
                    <span className="mb-1 rounded-full bg-zinc-200 px-2.5 py-0.5 text-[11px] font-bold text-zinc-600">NO</span>
                    {auto.branches.no.map((n, i) => (
                      <div key={n.id} className="flex flex-col items-center">
                        {i > 0 && <Connector />}
                        <Node n={n} selected={selected === n.id} onSelect={() => setSelected(n.id)} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        <div className="space-y-4 self-start">
          <Card>
            <CardHeader title={selectedNode ? selectedNode.label : "Node inspector"} subtitle={selectedNode ? undefined : "Select a node to configure it"} />
            <div className="px-4 py-4 text-[13px] leading-relaxed text-ink-2">
              {selectedNode ? (
                <>
                  <p>{selectedNode.detail || "No configuration."}</p>
                  {selectedNode.stats && <p className="mt-2 font-medium text-emerald-700">{selectedNode.stats}</p>}
                  {selectedNode.kind === "email" && (
                    <div className="mt-3 space-y-2 border-t border-line pt-3">
                      <button className="w-full rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-[#f0efec]">Edit email in builder</button>
                      <button className="w-full rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-[#f0efec]">Preview with sample contact</button>
                    </div>
                  )}
                </>
              ) : (
                <p>Triggers, delays, conditions, emails, webhooks and exits snap together on the canvas. Branching supports yes/no conditions and percentage splits.</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Flow settings" />
            <div className="space-y-2.5 px-4 py-4 text-[13px]">
              {[
                ["Re-entry", "Suppressed for 14 days"],
                ["Quiet hours", "22:00 to 08:00, contact time zone"],
                ["Exit early", "On purchase completion"],
                ["Frequency cap", "Max 1 automation email / day"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-ink-3">{k}</span>
                  <span className="text-right text-xs font-medium">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
