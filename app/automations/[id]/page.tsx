import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, GhostButton, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Badge, Stat } from "@/components/ui";
import { gbp, num } from "@/lib/data";
import { getAutomationsView } from "@/lib/server/views";
import { db } from "@/lib/server/db";
import { can, currentUser } from "@/lib/server/permissions";
import { AutomationStatusButton } from "@/components/automation-status-button";
import { RunsSection, type RunEventView, type RunView } from "./runs-section";

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

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The stoppedReason vocabulary from the engine, in plain English. Unknown
// reasons fall back to the raw word rather than hiding the run.
const stopReasons: Record<string, string> = {
  purchased: "Purchased",
  entered_other_workflow: "Entered another workflow",
  condition_failed: "Conditions not met",
  unsubscribed: "Unsubscribed",
  email_unavailable: "No email address",
  stopped_manually: "Stopped manually",
};

// One diary row as the timeline shows it. The kind carries the headline; the
// detail column stays as muted context because the engine writes step labels
// and provider names into it.
function eventView(e: { id: string; at: Date; kind: string; detail: string | null }): RunEventView {
  const when = fmt(e.at);
  const detail = e.detail ?? undefined;
  switch (e.kind) {
    case "started": return { id: e.id, when, text: "Started", detail };
    case "email_sent": return { id: e.id, when, text: "Email sent", detail };
    case "email_failed": return { id: e.id, when, text: "Email failed", detail };
    case "email_skipped": return { id: e.id, when, text: "Email skipped", detail };
    case "waiting": {
      // The engine writes "until <ISO>"; show the moment, not the ISO string.
      const m = /^until (.+)$/.exec(e.detail ?? "");
      const until = m ? new Date(m[1]) : null;
      return {
        id: e.id,
        when,
        text: until && !Number.isNaN(until.getTime()) ? `Waiting until ${fmt(until)}` : "Waiting",
      };
    }
    case "conditions_passed": return { id: e.id, when, text: "Conditions passed", detail };
    case "conditions_failed": return { id: e.id, when, text: e.detail ? `Conditions failed: ${e.detail}` : "Conditions failed" };
    case "stopped": return { id: e.id, when, text: "Stopped", detail };
    case "completed": return { id: e.id, when, text: "Completed" };
    default: return { id: e.id, when, text: e.kind.replace(/_/g, " "), detail };
  }
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
  const user = await currentUser();
  const role = user?.role ?? "viewer";
  const auto = (await getAutomationsView({ list: "all" })).find((a) => a.id === id);
  if (!auto) notFound();
  // A deleted workflow's page is an oversight view: only people who can see
  // the deleted list can open it.
  if (auto.deletedAt && !can(role, "view_deleted")) notFound();
  const isTemplate = auto.status === "draft" && auto.isDemo;

  // The numbers a live workflow owes its owner: who is in it right now, what
  // has actually gone out, and what failed, all from real rows.
  const [row, runningCount, sends, totalRuns, runsRaw] = await Promise.all([
    db.automation.findUnique({ where: { id }, select: { triggerEvent: true, entered: true, completed: true } }),
    db.automationRun.count({ where: { automationId: id, status: "running" } }),
    db.campaignSend.groupBy({
      by: ["status"],
      where: { campaign: { audienceType: "automation", audienceRef: id } },
      _count: true,
    }),
    db.automationRun.count({ where: { automationId: id } }),
    // The debugging table's rows: capped at the latest 100 so a big list
    // cannot balloon the page. The header notes when the cap bites.
    db.automationRun.findMany({
      where: { automationId: id },
      orderBy: { startedAt: "desc" },
      take: 100,
      include: { contact: { select: { email: true, firstName: true, lastName: true } } },
    }),
  ]);
  const sent = sends.filter((s) => ["sent", "delivered"].includes(s.status)).reduce((n, s) => n + s._count, 0);
  const simulated = sends.filter((s) => s.status === "simulated").reduce((n, s) => n + s._count, 0);
  const failedSends = sends.filter((s) => s.status === "failed").reduce((n, s) => n + s._count, 0);
  const lastRun = await db.automationRun.findFirst({
    where: { automationId: id },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  const providerArmed =
    process.env.EMAIL_SENDING_ENABLED === "true" &&
    Boolean(process.env.RESEND_API_KEY || process.env.AWS_ACCESS_KEY_ID);

  // Each run's diary, one query for all visible runs, oldest line first.
  const events = runsRaw.length
    ? await db.automationRunEvent.findMany({
        where: { runId: { in: runsRaw.map((r) => r.id) } },
        orderBy: { at: "asc" },
      })
    : [];
  const eventsByRun = new Map<string, RunEventView[]>();
  for (const e of events) {
    const list = eventsByRun.get(e.runId) ?? [];
    list.push(eventView(e));
    eventsByRun.set(e.runId, list);
  }

  // currentNode is a node id; the reader needs the step's label. Branch
  // steps are included so a run parked on one still names its step.
  const labelById = new Map<string, string>();
  for (const n of auto.nodes) labelById.set(n.id, n.label);
  if (auto.branches) {
    for (const n of [...auto.branches.yes, ...auto.branches.no]) labelById.set(n.id, n.label);
  }

  const runViews: RunView[] = runsRaw.map((r) => {
    const status: RunView["status"] =
      r.status === "running" ? "Running" : r.status === "completed" ? "Completed" : "Stopped";
    const name = [r.contact.firstName, r.contact.lastName].filter(Boolean).join(" ");
    return {
      id: r.id,
      contact: r.contact.email ?? (name || "Contact without email"),
      status,
      step: r.currentNode ? labelById.get(r.currentNode) ?? "Step removed from workflow" : "At start",
      nextDue: r.status === "running" && r.nextDueAt ? fmt(r.nextDueAt) : undefined,
      stoppedReason:
        status === "Stopped"
          ? r.stoppedReason
            ? stopReasons[r.stoppedReason] ?? r.stoppedReason.replace(/_/g, " ")
            : "Exited"
          : undefined,
      started: fmt(r.startedAt),
      ended: r.endedAt ? fmt(r.endedAt) : undefined,
      events: eventsByRun.get(r.id) ?? [],
    };
  });

  return (
    <Shell
      title={auto.name}
      subtitle={`Trigger: ${auto.trigger}`}
      actions={
        <>
          <AutomationStatusButton
            automationId={id}
            status={auto.status}
            deleted={Boolean(auto.deletedAt)}
            canDelete={can(role, "delete_records")}
            canRestore={can(role, "view_deleted")}
          />
          {!auto.deletedAt && (
            <Link href={`/automations/${id}/edit`}>
              <PrimaryButton>Edit workflow</PrimaryButton>
            </Link>
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/automations" className="text-xs font-semibold text-brand hover:underline">← All automations</Link>
        {isTemplate
          ? <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-zinc-600">Template · no live sends yet</span>
          : <Badge value={auto.status} />}
      </div>

      {auto.deletedAt && (
        <Card className="mt-3 border-line bg-zinc-50 px-5 py-3.5">
          <p className="text-sm font-bold">Deleted {auto.deletedAt}{auto.deletedBy ? ` by ${auto.deletedBy}` : ""}</p>
          <p className="mt-1 text-sm text-ink-2">
            This workflow no longer enrols contacts and is hidden from the
            working list. Everything it did — runs, sent emails, opens, clicks
            and revenue — remains in historical analytics and cannot be erased
            from here. Restoring brings it back paused.
          </p>
        </Card>
      )}

      {auto.status === "live" && !providerArmed && (
        <Card className="mt-3 border-amber-300 bg-amber-50 px-5 py-3.5">
          <p className="text-sm font-bold text-amber-900">ACTION REQUIRED · Email provider not connected</p>
          <p className="mt-1 text-sm text-amber-900">
            This workflow is live and enrolling contacts, but sends go to the
            development log only. Set EMAIL_SENDING_ENABLED and the provider
            keys in the hosting environment to deliver real email.
          </p>
        </Card>
      )}
      {failedSends > 0 && (
        <Card className="mt-3 border-red-200 bg-red-50 px-5 py-3.5">
          <p className="text-sm font-bold text-red-700">ACTION REQUIRED · {num(failedSends)} failed send{failedSends === 1 ? "" : "s"}</p>
          <p className="mt-1 text-sm text-red-700">The provider rejected these emails. Recent failures appear in the audit log with the reason.</p>
        </Card>
      )}

      {isTemplate ? (
        <Card className="mt-3 border-amber-200 bg-amber-50/50 px-5 py-3.5">
          <p className="text-sm text-amber-900">
            This is a recipe: open Edit workflow, choose what triggers it, write
            the emails, and set it live.
          </p>
        </Card>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-5">
          <Stat label="Contacts entered" value={num(row?.entered ?? auto.entered)} />
          <Stat label="In workflow now" value={num(runningCount)} />
          <Stat label="Completed" value={num(row?.completed ?? auto.completed)} />
          <Stat label="Emails sent" value={num(sent)} hint={simulated > 0 ? `${num(simulated)} simulated (no live provider)` : undefined} />
          <Stat
            label="Last triggered"
            value={lastRun ? lastRun.startedAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
          />
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

      {!isTemplate && <RunsSection automationId={id} runs={runViews} totalRuns={totalRuns} />}
    </Shell>
  );
}
