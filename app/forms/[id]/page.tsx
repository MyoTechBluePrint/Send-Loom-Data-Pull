// One form: edit it, see its numbers, grab the embed, watch signups land.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { Card, CardHeader, Badge } from "@/components/ui";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { num } from "@/lib/data";
import { FormEditor } from "@/components/form-editor";

export const dynamic = "force-dynamic";

export default async function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await demoWorkspaceId();
  const form = await db.form.findFirst({ where: { id, workspaceId } });
  if (!form) notFound();

  const stores = await db.store.findMany({
    where: { workspaceId },
    select: { name: true, publicId: true },
    orderBy: { name: "asc" },
  });

  // Recent signups: popup_submitted events that name this form.
  const events = await db.event.findMany({
    where: { workspaceId, type: "popup_submitted", payload: { contains: form.id } },
    orderBy: { occurredAt: "desc" },
    take: 8,
    select: { occurredAt: true, contactId: true },
  });
  const contactIds = [...new Set(events.map((e) => e.contactId).filter((v): v is string => !!v))];
  const contacts = contactIds.length
    ? await db.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, email: true, firstName: true } })
    : [];
  const byId = new Map(contacts.map((c) => [c.id, c]));

  return (
    <Shell
      title={form.name}
      subtitle="Change anything and save; live storefronts update within 5 minutes"
      actions={<Link href="/forms" className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-zinc-50">← All forms</Link>}
    >
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Status" action={<Badge value={form.status} />} />
          <div className="grid grid-cols-2 divide-x divide-line text-center">
            <div className="px-4 py-4">
              <p className="tabular text-xl font-bold">{num(form.views)}</p>
              <p className="text-xs text-ink-3">views</p>
            </div>
            <div className="px-4 py-4">
              <p className="tabular text-xl font-bold">{num(form.signups)}</p>
              <p className="text-xs text-ink-3">signups</p>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Put it on a website"
            subtitle="Stores with the Sendloom plugin or snippet pick live forms up automatically"
          />
          <div className="space-y-3 px-5 py-4">
            {stores.map((s) => (
              <div key={s.publicId}>
                <p className="mb-1 text-[12px] font-semibold text-ink-2">{s.name} · already connected? Nothing to do, set the form live.</p>
                <code className="block overflow-x-auto rounded-lg bg-zinc-900 px-3 py-2.5 text-[11.5px] leading-relaxed text-zinc-100">
                  {`<script src="https://sendloom.onrender.com/t/${s.publicId}.js" async></script>`}
                </code>
              </div>
            ))}
            {stores.length === 0 && <p className="text-[13px] text-ink-3">No stores connected yet. Add one in Store Tracking first.</p>}
            <p className="text-[12px] leading-relaxed text-ink-3">
              Any other website: paste the snippet before <code>&lt;/body&gt;</code> (or as a GTM custom HTML tag). One
              live popup shows per visitor, and every signup arrives as a consented contact.
            </p>
          </div>
        </Card>
      </div>

      <FormEditor
        initial={{
          id: form.id,
          status: form.status,
          name: form.name,
          headline: form.headline ?? "",
          body: form.body ?? "",
          buttonLabel: form.buttonLabel ?? "",
          consentLabel: form.consentLabel ?? "",
          successMessage: form.successMessage ?? "",
          offerCode: form.offerCode ?? "",
          accent: form.accent ?? "#6d28d9",
          collectName: form.collectName,
          triggerKind: (form.triggerKind as "time_on_page" | "exit_intent" | "scroll") ?? "time_on_page",
          triggerSeconds: form.triggerSeconds,
        }}
      />

      <Card className="mt-4">
        <CardHeader title="Recent signups" subtitle="Each one is a consented contact with the popup tick in its ledger" />
        <div className="divide-y divide-line">
          {events.map((e, i) => {
            const c = e.contactId ? byId.get(e.contactId) : undefined;
            return (
              <div key={i} className="flex items-center justify-between px-5 py-3 text-[13px]">
                <span className="font-medium">{c?.email ?? "(email pending)"}{c?.firstName ? ` · ${c.firstName}` : ""}</span>
                <span className="tabular text-xs text-ink-3">{e.occurredAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            );
          })}
          {events.length === 0 && <p className="px-5 py-6 text-center text-[13px] text-ink-3">No signups yet. They'll appear here the moment the form goes live on a site.</p>}
        </div>
      </Card>
    </Shell>
  );
}
