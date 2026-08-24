"use client";

// The workflow editor: the room behind the Edit workflow button.
//
// One column of steps, edited in place. The vocabulary is deliberately
// small: a trigger, emails, delays, an exit. Reorder with the arrows or by
// dragging a card; nothing here requires a manual. Save keeps the drawing;
// Set live opens the door; and an email step keeps its send history across
// edits because its id, and therefore its shadow campaign, survives.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell, GhostButton, PrimaryButton } from "@/components/shell";
import { Card, Badge } from "@/components/ui";

interface NodeDraft {
  id?: string;
  kind: "trigger" | "email" | "delay" | "exit";
  label: string;
  detail?: string | null;
  config: Record<string, unknown>;
  /** Whether this step's shadow campaign holds designed blocks, which then send. */
  designed?: boolean;
}

interface TriggerOption { value: string; label: string }

interface DesignSource { id: string; name: string }
interface DesignSources { campaigns: DesignSource[]; templates: DesignSource[] }

export function WorkflowEditor({ automationId }: { automationId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [triggerEvent, setTriggerEvent] = useState<string | null>(null);
  const [allowReentry, setAllowReentry] = useState(false);
  const [nodes, setNodes] = useState<NodeDraft[]>([]);
  const [triggerOptions, setTriggerOptions] = useState<TriggerOption[]>([]);
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
      setProblem("Save failed. Nothing was lost; try again.");
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
  const add = (kind: "email" | "delay") =>
    setNodes((ns) => {
      const insertAt = ns.findIndex((n) => n.kind === "exit");
      const node: NodeDraft =
        kind === "email"
          ? { kind, label: "New email", config: { subject: "", html: "" } }
          : { kind, label: "Wait", config: { hours: 24 } };
      const next = [...ns];
      next.splice(insertAt === -1 ? ns.length : insertAt, 0, node);
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
            <div
              key={n.id ?? `new-${at}`}
              draggable={n.kind !== "trigger"}
              onDragStart={() => setDragging(at)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging === null || dragging === at) return;
                setNodes((ns) => {
                  const next = [...ns];
                  const [moved] = next.splice(dragging, 1);
                  next.splice(at, 0, moved);
                  return next;
                });
                setDragging(null);
              }}
              className="mb-3"
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
          ))}

          <div className="flex gap-2">
            <button onClick={() => add("email")} className="rounded-lg border border-dashed border-line bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
              + Email step
            </button>
            <button onClick={() => add("delay")} className="rounded-lg border border-dashed border-line bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
              + Delay
            </button>
          </div>
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
  onOpenEditor, onAdopt, sources,
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
}) {
  const chrome: Record<string, { border: string; chip: string; icon: string; word: string }> = {
    trigger: { border: "border-violet-300", chip: "bg-violet-100 text-violet-700", icon: "⚡", word: "Trigger" },
    email: { border: "border-blue-200", chip: "bg-blue-50 text-blue-700", icon: "✉", word: "Email" },
    delay: { border: "border-line", chip: "bg-zinc-100 text-zinc-600", icon: "◷", word: "Delay" },
    exit: { border: "border-line", chip: "bg-zinc-100 text-zinc-600", icon: "⏹", word: "Exit" },
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
              required unsubscribe footer are added automatically.
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
        <div className="mt-3 flex items-center gap-2">
          <p className="text-xs font-medium text-ink-3">Wait</p>
          <input
            type="number"
            min={0}
            max={720}
            value={Number(node.config.hours ?? 24)}
            onChange={(e) => onConfig("hours", Math.max(0, Number(e.target.value)))}
            className="w-24 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <p className="text-xs font-medium text-ink-3">hours before the next step</p>
        </div>
      )}
    </div>
  );
}
