import Link from "next/link";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Badge, Th, Td } from "@/components/ui";
import { num } from "@/lib/data";
import { getFormsView } from "@/lib/server/views";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const forms = await getFormsView();
  const anyLive = forms.some((f) => f.status === "live");

  return (
    <Shell
      title="Popups & Forms"
      subtitle={anyLive ? "Capture subscribers on-site · consent logged automatically" : "Templates ready · activate one after MyoTech/Novatec tracking connects"}
      actions={<Link href="/forms/new"><PrimaryButton>New form</PrimaryButton></Link>}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[760px]">
            <thead className="border-b border-line">
              <tr>
                <Th>Form</Th>
                <Th>Trigger</Th>
                <Th className="text-right">Views</Th>
                <Th className="text-right">Signups</Th>
                <Th className="text-right">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {forms.map((f) => (
                <tr key={f.id} className="hover:bg-[#fafaf8]">
                  <Td>
                    <Link href={`/forms/${f.id}`} className="font-medium text-brand hover:underline">{f.name}</Link>
                    <p className="text-xs text-ink-3">{f.type}</p>
                  </Td>
                  <Td className="text-xs text-ink-2">{f.trigger}</Td>
                  <Td className="tabular text-right">{f.views ? num(f.views) : "–"}</Td>
                  <Td className="tabular text-right font-semibold">{f.signups ? num(f.signups) : "–"}</Td>
                  <Td className="text-right">
                    {f.status === "draft" && f.isDemo
                      ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600">Template</span>
                      : <Badge value={f.status} />}
                  </Td>
                </tr>
              ))}
              {forms.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-3">No forms yet.</td></tr>
              )}
            </tbody>
          </table></div>
        </Card>

        <div className="space-y-4 self-start">
          <Card>
            <CardHeader title="How activation works" />
            <ol className="space-y-2 px-5 py-4 text-[13px] text-ink-2">
              {[
                "Install the WooCommerce plugin on MyoTech or Novatec.",
                "Confirm events arrive in Store Tracking.",
                "Set a template's status to live: the storefront tracker picks it up within 5 minutes.",
                "Submissions create consented contacts with popup evidence in the ledger.",
              ].map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">{i + 1}</span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
            <div className="border-t border-line px-5 py-3">
              <Link href="/tracking" className="text-[13px] font-bold text-brand hover:underline">Open Store Tracking →</Link>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
