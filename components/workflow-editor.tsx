"use client";

// The workflow editor: the room behind the Edit workflow button.
//
// One vertical sequence, read top to bottom the way a contact walks it:
// labelled cards joined by a connector line, with an add control in every
// gap. The vocabulary is deliberately small: a trigger, emails, waits,
// checks, an exit; new step types are one STEP_PALETTE entry, not new ifs.
// Reorder with the arrows or by dragging a card; nothing here requires a
// manual. Save keeps the drawing; Set live opens the door; and an email
// step keeps its send history across edits because its id, and therefore
// its shadow campaign, survives.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell, GhostButton, PrimaryButton } from "@/components/shell";
import { Card, Badge } from "@/components/ui";

interface NodeDraft {
  id?: string;
  kind: "trigger" | "email" | "delay" | "condition" | "exit";
  label: string;
  detail?: string | null;
  config: Record<string, unknown>;
  /** Whether this step's shadow campaign holds designed blocks, which then send. */
  designed?: boolean;
}

interface TriggerOption { value: string; label: string }

/** One entry of the server's condition registry, served by the GET. */
interface ConditionTypeInfo { type: string; label: string; description: string }

interface DesignSource { id: string; name: string }
interface DesignSources { campaigns: DesignSource[]; templates: DesignSource[] }

// The step vocabulary as data: the add menus and the card chrome both read
// this list, so a future step type is a new entry here, not new branches.
const STEP_PALETTE: {
  kind: NodeDraft["kind"];
  word: string;
  icon: string;
  chip: string;
  border: string;
  hint: string;
  make: () => NodeDraft;
}[] = [
  {
    kind: "email",
    word: "Send Email",
    icon: "✉",
    chip: "bg-blue-50 text-blue-700",
    border: "border-blue-200",
    hint: "Deliver an email to the contact",
    make: () => ({ kind: "email", label: "New email", config: { subject: "", html: "" } }),
  },
  {
    kind: "delay",
    word: "Wait",
    icon: "◷",
    chip: "bg-zinc-100 text-zinc-600",
    border: "border-line",
    hint: "Pause before the next step",
    make: () => ({ kind: "delay", label: "Wait", config: { minutes: 24 * 60 } }),
  },
  {
    kind: "condition",
    word: "Check If",
    icon: "?",
    chip: "bg-amber-100 text-amber-700",
    border: "border-amber-300",
    hint: "Only continue while the checks still hold",
    make: () => ({ kind: "condition", label: "Check if", config: { match: "all", conditions: [] } }),
  },
];

// Wait durations the chips offer, in the minutes the step persists.
const WAIT_PRESETS: { label: string; minutes: number }[] = [
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "12 hours", minutes: 720 },
  { label: "24 hours", minutes: 1440 },
  { label: "2 days", minutes: 2880 },
  { label: "3 days", minutes: 4320 },
  { label: "7 days", minutes: 10080 },
];

type WaitUnit = "minutes" | "hours" | "days";
const UNIT_MINUTES: Record<WaitUnit, number> = { minutes: 1, hours: 60, days: 1440 };
const MAX_WAIT_MINUTES = 60 * 24 * 60;

/** What this wait step means in minutes: the new field when set, otherwise
 *  the hours every pre-minutes workflow was saved with. */
const waitMinutesOf = (config: Record<string, unknown>): number => {
  const m = Number(config.minutes);
  if (config.minutes != null && Number.isFinite(m)) {
    return Math.min(MAX_WAIT_MINUTES, Math.max(1, Math.round(m)));
  }
  const h = Number(config.hours ?? 24);
  return Math.round((Number.isFinite(h) ? Math.max(0, h) : 24) * 60);
};

const unitFor = (mins: number): WaitUnit =>
  mins % 1440 === 0 ? "days" : mins % 60 === 0 ? "hours" : "minutes";

const humanizeWait = (mins: number): string => {
  const unit = unitFor(mins);
  const n = mins / UNIT_MINUTES[unit];
  return `${n} ${n === 1 ? unit.slice(0, -1) : unit}`;
};

export function WorkflowEditor({ automationId }: { automationId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [triggerEvent, setTriggerEvent] = useState<string | null>(null);
  const [allowReentry, setAllowReentry] = useState(false);
  const [nodes, setNodes] = useState<NodeDraft[]>([]);
  const [triggerOptions, setTriggerOptions] = useState<TriggerOption[]>([]);
  const [conditionTypes, setConditionTypes] = useState<ConditionTypeInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ html: string; subject: string } | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [confirmTest, setConfirmTest] = useState<NodeDraft | null>(null);
  const [sources, setSources] = useState<DesignSources>({ campaigns: [], templates: [] });
  const [confirmAdopt, setConfirmAdopt] = useState<{ at: number; kind: "campaign" | "template"; id: string; name: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/automations/${automationId}`);
      const json = await res.json();
      if (!json.ok) { setProblem("This workflow could not be loaded."); return; }
      const a = json.automation;
      setName(a.name);
      setStatus(a.status);
      setTriggerEvent(a.triggerEvent);
      setAllowReentry(a.allowReentry);
      setTriggerOptions(json.triggerEvents);
      setConditionTypes(Array.isArray(json.conditionTypes) ? json.conditionTypes : []);
      setSources(json.sources ?? { campaigns: [], templates: [] });
      setNodes(
        (a.nodes as NodeDraft[]).length
          ? (a.nodes as NodeDraft[])
          : [{ kind: "trigger", label: "Trigger", config: {} }],
      );
      setLoaded(true);
    })();
  }, [automationId]);

  const say = (text: string) => { setFlash(text); setTimeout(() => setFlash(null), 3000); };

  const save = async (): Promise<NodeDraft[] | null> => {
    setBusy("save"); setProblem(null);
    try {
      const body = {
        nodes: nodes.map((n) => ({
          id: n.id, kind: n.kind, label: n.label, detail: n.detail ?? undefined, config: n.config,
        })),
      };
      const [nodesRes, metaRes] = await Promise.all([
        fetch(`/api/automations/${automationId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }),
        fetch(`/api/automations/${automationId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, triggerEvent, allowReentry }),
        }),
      ]);
      const nodesJson = await nodesRes.json();
      const metaJson = await metaRes.json();
      if (nodesJson.ok && metaJson.ok) {
        // The server hands the saved steps back with their ids and shadow
        // campaign ids: a brand-new step becomes openable in the full editor
        // immediately, and a re-save cannot recreate it as a fresh row.
        const fresh: NodeDraft[] = Array.isArray(nodesJson.nodes) ? nodesJson.nodes : nodes;
        setNodes(fresh);
        say("Saved.");
        router.refresh();
        return fresh;
      }
      // The server refuses with a plain sentence (too many email steps, an
      // unknown check); show that sentence rather than a shrug.
      const serverSays = [nodesJson?.error, metaJson?.error].find(
        (e): e is string => typeof e === "string",
      );
      setProblem(serverSays ?? "Save failed. Nothing was lost; try again.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  // The full editor lives at the step's shadow campaign, which exists once
  // the workflow has been saved. Save first so an unsaved new step gets its
  // campaign, then go.
  const openFullEditor = async (at: number) => {
    const fresh = await save();
    if (!fresh) return;
    const campaignId = fresh[at]?.config?.campaignId;
    if (typeof campaignId === "string" && campaignId) {
      router.push(`/campaigns/${campaignId}/email`);
    } else {
      setProblem("This step could not be opened in the full editor. Save the workflow and try again.");
    }
  };

  // Copy an existing design onto this step's shadow campaign, after the
  // explicit confirm (it overwrites whatever design the step already has).
  const adopt = async () => {
    const target = confirmAdopt;
    if (!target) return;
    const fresh = await save();
    if (!fresh) { setConfirmAdopt(null); return; }
    const nodeId = fresh[target.at]?.id;
    if (!nodeId) { setProblem("Save the workflow, then try copying again."); setConfirmAdopt(null); return; }
    setBusy("adopt");
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adopt_content", nodeId, source: { kind: target.kind, id: target.id } }),
      });
      const json = await res.json();
      if (json.ok) {
        setNodes((ns) => ns.map((n, i) =>
          i === target.at ? { ...n, designed: true, config: { ...n.config, campaignId: json.campaignId } } : n,
        ));
        say("Design copied. This step now sends the designed email.");
      } else {
        setProblem(json.error ?? "Could not copy that design.");
      }
      setConfirmAdopt(null);
    } finally {
      setBusy(null);
    }
  };

  const setLive = async (next: "live" | "paused") => {
    if (!(await save())) return;
    setBusy("live");
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (json.ok) { setStatus(json.status); say(next === "live" ? "Workflow is LIVE." : "Paused."); }
      else setProblem(json.error ?? "Could not change status.");
    } finally {
      setBusy(null);
    }
  };

  const update = (at: number, patch: Partial<NodeDraft>) =>
    setNodes((ns) => ns.map((n, i) => (i === at ? { ...n, ...patch } : n)));
  const updateConfig = (at: number, key: string, value: unknown) =>
    setNodes((ns) => ns.map((n, i) => (i === at ? { ...n, config: { ...n.config, [key]: value } } : n)));
  const move = (at: number, dir: -1 | 1) =>
    setNodes((ns) => {
      const to = at + dir;
      if (to <= 0 && ns[0]?.kind === "trigger" && at !== 0) return ns; // nothing above the trigger
      if (to < 0 || to >= ns.length) return ns;
      const next = [...ns];
      [next[at], next[to]] = [next[to], next[at]];
      return next;
    });
  const remove = (at: number) => setNodes((ns) => ns.filter((_, i) => i !== at));
  const insertAt = (index: number, kind: NodeDraft["kind"]) =>
    setNodes((ns) => {
      const entry = STEP_PALETTE.find((p) => p.kind === kind);
      if (!entry) return ns;
      // Nothing goes above the trigger, whatever gap was clicked.
      const floor = ns[0]?.kind === "trigger" ? 1 : 0;
      const next = [...ns];
      next.splice(Math.max(floor, Math.min(index, ns.length)), 0, entry.make());
      return next;
    });

  if (!loaded) {
    return (
      <Shell title="Edit workflow" subtitle="Loading…">
        {problem && <Card className="border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-700">{problem}</Card>}
      </Shell>
    );
  }

  return (
    <Shell
      title={name || "Edit workflow"}
      subtitle="Changes apply when you save · going live starts enrolling real contacts"
      actions={
        <>
          <GhostButton onClick={() => void save()} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save"}
          </GhostButton>
          {status === "live" ? (
            <button
              onClick={() => void setLive("paused")}
              disabled={busy !== null}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-[13px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              Pause workflow
            </button>
          ) : (
            <PrimaryButton onClick={() => void setLive("live")} disabled={busy !== null}>
              {busy === "live" ? "Publishing…" : "Save & set live"}
            </PrimaryButton>
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/automations/${automationId}`} className="text-xs font-semibold text-brand hover:underline">
          ← Back to workflow
        </Link>
        <Badge value={status} />
        {status === "live" && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-emerald-700">
            Enrolling contacts
          </span>
        )}
      </div>

      {flash && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{flash}</div>}
      {problem && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{problem}</div>}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreview(null)}>
          <div onClick={(e) => e.stopPropagation()} className="flex h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <p className="text-sm font-semibold">Preview · {preview.subject}</p>
              <button onClick={() => setPreview(null)} className="text-sm font-semibold text-ink-3 hover:text-ink-2">Close</button>
            </div>
            <iframe title="Email preview" srcDoc={preview.html} className="w-full flex-1 rounded-b-2xl" />
          </div>
        </div>
      )}

      {confirmTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmTest(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">Send a test email?</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              One email goes to <b>you only</b>, never to customers. The reply
              will say which transport carried it, so a dev-log test is never
              mistaken for a delivered one.
            </p>
            <dl className="mt-3 space-y-1 rounded-lg border border-line px-3 py-2 text-[12.5px]">
              <div className="flex justify-between"><dt className="text-ink-3">Subject</dt><dd className="font-medium">[Test] {String(confirmTest.config.subject || confirmTest.label)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Channel</dt><dd className="font-medium">Email</dd></div>
            </dl>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmTest(null)} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">Cancel</button>
              <button
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("test");
                  try {
                    const res = await fetch(`/api/automations/${automationId}/test-send`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ subject: confirmTest.config.subject, previewText: confirmTest.config.previewText, html: confirmTest.config.html, nodeId: confirmTest.id }),
                    });
                    const json = await res.json();
                    setTestResult(
                      json.ok
                        ? json.real
                          ? `Real email sent to ${json.to} via ${json.transport}${json.providerMessageId ? ` · provider id ${json.providerMessageId}` : ""}`
                          : `Simulated only: written to the ${json.transport} transport, no real email delivered. Connect the provider to send for real.`
                        : `Test failed: ${json.detail ?? "provider refused"}`,
                    );
                    setConfirmTest(null);
                  } finally {
                    setBusy(null);
                  }
                }}
                className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
              >
                {busy === "test" ? "Sending…" : "Send test to me"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAdopt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmAdopt(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">Copy this design onto the step?</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              The design from <b>{confirmAdopt.name}</b> will be copied onto this step,
              replacing anything already designed for it. The step&apos;s subject and
              preview text are kept, and the designed email becomes what sends.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmAdopt(null)} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">Cancel</button>
              <button
                disabled={busy !== null}
                onClick={() => void adopt()}
                className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {busy === "adopt" ? "Copying…" : "Copy design"}
              </button>
            </div>
          </div>
        </div>
      )}

      {testResult && (
        <div className="mt-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink-2">
          {testResult}
          <button onClick={() => setTestResult(null)} className="ml-3 text-xs font-semibold text-ink-3 hover:text-ink-2">Dismiss</button>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {nodes.map((n, at) => (
            <div key={n.id ?? `new-${at}`}>
              {/* The connector from the card above, with the gap's add
                  control sitting on the line. Every pair of steps gets one. */}
              {at > 0 && (
                <div className="flex flex-col items-center">
                  <div className="h-2.5 w-px bg-line" />
                  <AddStep onAdd={(kind) => insertAt(at, kind)} />
                  <div className="h-2.5 w-px bg-line" />
                </div>
              )}
              <div
                draggable={n.kind !== "trigger"}
                onDragStart={() => setDragging(at)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragging === null || dragging === at) return;
                  // The trigger stays first: a drop onto it is a no-op.
                  if (at === 0 && nodes[0]?.kind === "trigger") { setDragging(null); return; }
                  setNodes((ns) => {
                    const next = [...ns];
                    const [moved] = next.splice(dragging, 1);
                    next.splice(at, 0, moved);
                    return next;
                  });
                  setDragging(null);
                }}
              >
                <StepCard
                node={n}
                first={at === 0}
                last={at === nodes.length - 1}
                triggerOptions={triggerOptions}
                triggerEvent={triggerEvent}
                onTrigger={setTriggerEvent}
                onChange={(patch) => update(at, patch)}
                onConfig={(k, v) => updateConfig(at, k, v)}
                onMove={(dir) => move(at, dir)}
                onRemove={() => remove(at)}
                onPreview={async () => {
                  const res = await fetch(`/api/automations/${automationId}/preview`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subject: n.config.subject, previewText: n.config.previewText, html: n.config.html, nodeId: n.id }),
                  });
                  const json = await res.json();
                  if (json.ok) setPreview({ html: json.html, subject: String(n.config.subject ?? n.label) });
                }}
                onTest={() => setConfirmTest(n)}
                onOpenEditor={() => void openFullEditor(at)}
                onAdopt={(kind, source) => setConfirmAdopt({ at, kind, id: source.id, name: source.name })}
                sources={sources}
                conditionTypes={conditionTypes}
                onDuplicate={() =>
                  setNodes((ns) => {
                    const copy: NodeDraft = { kind: n.kind, label: `${n.label} (copy)`, detail: n.detail, config: { ...n.config } };
                    delete (copy.config as Record<string, unknown>).campaignId;
                    const next = [...ns];
                    next.splice(at + 1, 0, copy);
                    return next;
                  })
                }
                />
              </div>
            </div>
          ))}

          {/* The end of the line. When the sequence closes with an Exit card
              the gap before it already offers an insert, so no control here. */}
          {nodes[nodes.length - 1]?.kind !== "exit" && (
            <div className="flex flex-col items-center">
              <div className="h-2.5 w-px bg-line" />
              <AddStep prominent onAdd={(kind) => insertAt(nodes.length, kind)} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="px-5 py-4">
            <p className="text-[13px] font-semibold">Workflow name</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <label className="mt-4 flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={allowReentry}
                onChange={(e) => setAllowReentry(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#6d28d9]"
              />
              <span>
                <span className="block text-[13px] font-medium">Allow contacts to enter this workflow again</span>
                <span className="block text-xs text-ink-3">
                  Off means one welcome series per person, ever, however many times they submit the form.
                </span>
              </span>
            </label>
          </Card>
          <Card className="px-5 py-4 text-xs leading-relaxed text-ink-3">
            <p className="font-semibold text-ink-2">How sending works</p>
            <p className="mt-1.5">
              Email steps send only to contacts with granted email consent, never to
              anyone unsubscribed, suppressed or marked Do Not Contact. Each contact
              can receive each email step once. Every send lands in the contact's
              timeline and this workflow's numbers.
            </p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

function StepCard({
  node, first, last, triggerOptions, triggerEvent,
  onTrigger, onChange, onConfig, onMove, onRemove, onPreview, onTest, onDuplicate,
  onOpenEditor, onAdopt, sources, conditionTypes,
}: {
  node: NodeDraft;
  first: boolean;
  last: boolean;
  triggerOptions: TriggerOption[];
  triggerEvent: string | null;
  onTrigger: (v: string) => void;
  onChange: (patch: Partial<NodeDraft>) => void;
  onConfig: (key: string, value: unknown) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onPreview: () => void;
  onTest: () => void;
  onDuplicate: () => void;
  onOpenEditor: () => void;
  onAdopt: (kind: "campaign" | "template", source: DesignSource) => void;
  sources: DesignSources;
  conditionTypes: ConditionTypeInfo[];
}) {
  // Card chrome comes from the palette for the addable kinds, so a step's
  // card and its add-menu entry can never drift apart.
  const chrome: Record<string, { border: string; chip: string; icon: string; word: string }> = {
    trigger: { border: "border-violet-300", chip: "bg-violet-100 text-violet-700", icon: "⚡", word: "Trigger" },
    exit: { border: "border-line", chip: "bg-zinc-100 text-zinc-600", icon: "⏹", word: "Exit" },
    ...Object.fromEntries(
      STEP_PALETTE.map((p) => [p.kind, { border: p.border, chip: p.chip, icon: p.icon, word: p.word }]),
    ),
  };
  const c = chrome[node.kind] ?? chrome.exit;

  return (
    <div className={`rounded-xl border-2 bg-surface px-4 py-3.5 shadow-sm ${c.border}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${c.chip}`}>{c.icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{c.word}</span>
        <div className="ml-auto flex items-center gap-1">
          {node.kind !== "trigger" && (
            <>
              {node.kind === "email" && (
                <>
                  <button onClick={onPreview} className="rounded px-2 py-0.5 text-xs font-semibold text-brand hover:bg-brand-soft">Preview</button>
                  <button onClick={onTest} className="rounded px-2 py-0.5 text-xs font-semibold text-brand hover:bg-brand-soft">Test send</button>
                </>
              )}
              <button
                onClick={() => onConfig("disabled", !node.config.disabled)}
                className={`rounded px-2 py-0.5 text-xs font-semibold ${node.config.disabled ? "bg-zinc-200 text-zinc-600" : "text-ink-3 hover:bg-[#f0efec]"}`}
                title={node.config.disabled ? "Step is off: the workflow skips it" : "Turn this step off without deleting it"}
              >
                {node.config.disabled ? "Off" : "On"}
              </button>
              <button onClick={onDuplicate} className="rounded px-1.5 py-0.5 text-xs text-ink-3 hover:bg-[#f0efec]" aria-label="Duplicate step" title="Duplicate step">⧉</button>
              <button onClick={() => onMove(-1)} disabled={first} className="rounded px-1.5 py-0.5 text-xs text-ink-3 hover:bg-[#f0efec] disabled:opacity-30" aria-label="Move up">↑</button>
              <button onClick={() => onMove(1)} disabled={last} className="rounded px-1.5 py-0.5 text-xs text-ink-3 hover:bg-[#f0efec] disabled:opacity-30" aria-label="Move down">↓</button>
              <button onClick={onRemove} className="rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50" aria-label="Remove step">✕</button>
            </>
          )}
        </div>
      </div>

      {node.kind === "trigger" && (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-3">What starts this workflow?</p>
          <select
            value={triggerEvent ?? ""}
            onChange={(e) => onTrigger(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="" disabled>Choose a trigger…</option>
            {triggerOptions.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      )}

      {node.kind === "email" && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-ink-3">Step name</p>
            <input
              value={node.label}
              onChange={(e) => onChange({ label: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-3">Subject line</p>
            <input
              value={String(node.config.subject ?? "")}
              onChange={(e) => onConfig("subject", e.target.value)}
              placeholder="Welcome — here's your code"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-3">Preview text <span className="font-normal">(the line inboxes show after the subject)</span></p>
            <input
              value={String(node.config.previewText ?? "")}
              onChange={(e) => onConfig("previewText", e.target.value)}
              placeholder="Your discount code is inside"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-3">Email content</p>
            <textarea
              value={String(node.config.html ?? "")}
              onChange={(e) => onConfig("html", e.target.value)}
              rows={6}
              placeholder="<p>Hi — thanks for joining. Here's your discount code…</p>"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-[12.5px] outline-none focus:border-brand"
            />
            <p className="mt-1 text-[11px] text-ink-3">
              Plain sentences or simple HTML. Your brand logo and the legally
              required unsubscribe footer are added automatically. Merge
              fields: {"{{first_name}}"}, {"{{discount_code}}"},{" "}
              {"{{discount_value}}"}, {"{{discount_expiry}}"},{" "}
              {"{{store_url}}"}. Discount fields fill in when the email (or an
              earlier one in this workflow) carries a discount block, and a
              follow-up always shows the same code as the first email.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-[#faf9f7] px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${node.designed ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-600"}`}>
                {node.designed ? "Designed email sends" : "Simple text sends"}
              </span>
              <button
                onClick={onOpenEditor}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-brand hover:border-brand"
              >
                Open full email editor
              </button>
              <select
                value=""
                onChange={(e) => {
                  const [kind, sourceId] = e.target.value.split(":");
                  const list = kind === "campaign" ? sources.campaigns : sources.templates;
                  const src = list.find((s) => s.id === sourceId);
                  if (src && (kind === "campaign" || kind === "template")) onAdopt(kind, src);
                  e.target.value = "";
                }}
                disabled={!sources.campaigns.length && !sources.templates.length}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2 outline-none focus:border-brand disabled:opacity-50"
              >
                <option value="">
                  {sources.campaigns.length || sources.templates.length
                    ? "Start from an existing email…"
                    : "No designed emails to copy yet"}
                </option>
                {sources.campaigns.length > 0 && (
                  <optgroup label="Campaigns">
                    {sources.campaigns.map((s) => (
                      <option key={s.id} value={`campaign:${s.id}`}>{s.name}</option>
                    ))}
                  </optgroup>
                )}
                {sources.templates.length > 0 && (
                  <optgroup label="Templates">
                    {sources.templates.map((s) => (
                      <option key={s.id} value={`template:${s.id}`}>{s.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
              {node.designed
                ? "A designed email is attached to this step and is what will send. The subject and preview text above still apply; the simple content box is kept but ignored while the design exists."
                : "This step sends the simple content above, dressed with your logo and footer. Open the full editor to design a richer email for this step."}
            </p>
          </div>
        </div>
      )}

      {node.kind === "delay" && (
        <WaitEditor
          config={node.config}
          onSet={(minutes) => onConfig("minutes", minutes)}
        />
      )}

      {node.kind === "condition" && (
        <ConditionEditor
          config={node.config}
          types={conditionTypes}
          onSet={(conditions) =>
            // Match is fixed to ALL for now: every check must hold. The
            // config already carries the field so an ANY option later is a
            // select, not a migration.
            onChange({ config: { ...node.config, match: "all", conditions } })
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The add control that lives in every gap of the sequence and at its end.
 * Closed, it is a quiet plus on the connector line (or the labelled pill at
 * the end); open, it offers the palette. The options are STEP_PALETTE
 * entries, so a new step type appears here without this component changing.
 */
function AddStep({ prominent, onAdd }: {
  prominent?: boolean;
  onAdd: (kind: NodeDraft["kind"]) => void;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="my-1 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-sm">
        {STEP_PALETTE.map((p) => (
          <button
            key={p.kind}
            onClick={() => { onAdd(p.kind); setOpen(false); }}
            title={p.hint}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand"
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${p.chip}`}>{p.icon}</span>
            {p.word}
          </button>
        ))}
        <button
          onClick={() => setOpen(false)}
          className="px-1.5 text-xs font-semibold text-ink-3 hover:text-ink-2"
          aria-label="Cancel adding a step"
        >
          ✕
        </button>
      </div>
    );
  }

  return prominent ? (
    <button
      onClick={() => setOpen(true)}
      className="mt-0.5 rounded-lg border border-dashed border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand"
    >
      + Add step
    </button>
  ) : (
    <button
      onClick={() => setOpen(true)}
      aria-label="Add a step here"
      title="Add a step here"
      className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-sm font-semibold leading-none text-ink-3 shadow-sm hover:border-brand hover:text-brand"
    >
      +
    </button>
  );
}

/**
 * The Wait card's body: preset chips for the durations people actually use,
 * and a custom editor for everything else. Whatever is chosen persists as
 * minutes; a pre-minutes step saved in hours displays as those hours until
 * it is touched, and its stored hours are never rewritten by loading.
 */
function WaitEditor({ config, onSet }: {
  config: Record<string, unknown>;
  onSet: (minutes: number) => void;
}) {
  const mins = waitMinutesOf(config);
  const matched = WAIT_PRESETS.find((p) => p.minutes === mins);
  const [custom, setCustom] = useState(!matched);
  const [unit, setUnit] = useState<WaitUnit>(unitFor(mins));
  const [value, setValue] = useState(String(mins / UNIT_MINUTES[unitFor(mins)]));

  const commit = (v: string, u: WaitUnit) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return; // keep typing; nothing saved yet
    onSet(Math.min(MAX_WAIT_MINUTES, Math.max(1, Math.round(n * UNIT_MINUTES[u]))));
  };

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-ink-3">How long does the contact wait here?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {WAIT_PRESETS.map((p) => {
          const active = !custom && p.minutes === mins;
          return (
            <button
              key={p.minutes}
              onClick={() => {
                onSet(p.minutes);
                setCustom(false);
                setUnit(unitFor(p.minutes));
                setValue(String(p.minutes / UNIT_MINUTES[unitFor(p.minutes)]));
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                active
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line text-ink-2 hover:border-brand hover:text-brand"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          onClick={() => setCustom(true)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            custom
              ? "border-brand bg-brand-soft text-brand"
              : "border-line text-ink-2 hover:border-brand hover:text-brand"
          }`}
        >
          Custom
        </button>
      </div>
      {custom && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => { setValue(e.target.value); commit(e.target.value, unit); }}
            className="w-24 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <select
            value={unit}
            onChange={(e) => {
              const u = e.target.value as WaitUnit;
              setUnit(u);
              commit(value, u);
            }}
            className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
          <p className="text-[11px] text-ink-3">1 minute to 60 days.</p>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-3">
        Waits <b className="text-ink-2">{humanizeWait(mins)}</b>, then continues to the next step.
      </p>
    </div>
  );
}

/**
 * The Check If card's body: the server's condition vocabulary as labelled
 * toggles, and a plain sentence saying what the step now means. Every
 * ticked check must hold (match ALL); a contact who fails one leaves the
 * sequence there, with the reason on the run.
 */
function ConditionEditor({ config, types, onSet }: {
  config: Record<string, unknown>;
  types: ConditionTypeInfo[];
  onSet: (conditions: { type: string }[]) => void;
}) {
  const selected = Array.isArray(config.conditions)
    ? (config.conditions as { type?: unknown }[])
        .map((c) => (typeof c?.type === "string" ? c.type : ""))
        .filter(Boolean)
    : [];

  const toggle = (type: string) => {
    const next = selected.includes(type)
      ? selected.filter((t) => t !== type)
      : [...selected, type];
    onSet(next.map((t) => ({ type: t })));
  };

  // "Has not purchased since entering" reads as "Has NOT purchased since
  // entering" in the summary, and later checks lose their capital so the
  // sentence flows: derived from the labels, never per-type wording.
  const summary = selected
    .map((t, i) => {
      const label = (types.find((x) => x.type === t)?.label ?? t).replace(/\bnot\b/i, "NOT");
      return i === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1);
    })
    .join(" AND ");

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-ink-3">
        Only continue if every ticked check still holds when the contact
        reaches this step. Checks run on live data, here and again just
        before the next email sends.
      </p>
      <div className="mt-2 space-y-2">
        {types.map((ct) => {
          const on = selected.includes(ct.type);
          return (
            <label
              key={ct.type}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                on ? "border-amber-300 bg-amber-50/60" : "border-line hover:border-amber-300"
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(ct.type)}
                className="mt-0.5 h-4 w-4 accent-[#b45309]"
              />
              <span>
                <span className="block text-[13px] font-medium">{ct.label}</span>
                <span className="block text-xs leading-relaxed text-ink-3">{ct.description}</span>
              </span>
            </label>
          );
        })}
        {types.length === 0 && (
          <p className="rounded-lg border border-line px-3 py-2.5 text-xs text-ink-3">
            No checks are available yet. Reload the editor to fetch them.
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-3">
        {selected.length
          ? <>Continues only if <b className="text-ink-2">{summary}</b>.</>
          : "No checks ticked yet: everyone passes straight through."}
      </p>
    </div>
  );
}
