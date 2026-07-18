import { Shell, PrimaryButton } from "@/components/shell";
import { Card, Badge, Th, Td } from "@/components/ui";
import { forms, num } from "@/lib/data";

export default function FormsPage() {
  return (
    <Shell
      title="Forms & Popups"
      subtitle="Capture subscribers on-site · consent logged automatically"
      actions={<PrimaryButton>New form</PrimaryButton>}
    >
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <Th>Form</Th>
                <Th>Trigger</Th>
                <Th className="text-right">Views</Th>
                <Th className="text-right">Signups</Th>
                <Th className="text-right">Conversion</Th>
                <Th className="text-right">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {forms.map((f) => (
                <tr key={f.id} className="hover:bg-[#fafaf8]">
                  <Td>
                    <p className="font-medium">{f.name}</p>
                    <p className="text-xs text-ink-3">{f.type}</p>
                  </Td>
                  <Td className="text-xs text-ink-2">{f.trigger}</Td>
                  <Td className="tabular text-right">{f.views ? num(f.views) : "–"}</Td>
                  <Td className="tabular text-right font-semibold">{f.signups ? num(f.signups) : "–"}</Td>
                  <Td className="tabular text-right">{f.views ? `${((f.signups / f.views) * 100).toFixed(1)}%` : "–"}</Td>
                  <Td className="text-right"><Badge value={f.status} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-4 self-start">
          <Card className="overflow-hidden">
            <p className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Live preview · Welcome offer</p>
            <div className="bg-[#efeae2] p-6">
              <div className="mx-auto max-w-64 rounded-xl bg-white p-5 text-center shadow-lg">
                <p className="font-serif text-lg tracking-[0.2em] text-[#3a3532]">VITALIS</p>
                <p className="mt-2 text-sm font-semibold text-[#2b2724]">Get 15% off your first order</p>
                <p className="mt-1 text-xs text-[#8a837c]">Evidence-led wellness, early access and practitioner Q&As.</p>
                <div className="mt-3 rounded-md border border-[#ddd6cd] px-3 py-2 text-left text-xs text-[#a09a93]">you@email.com</div>
                <div className="mt-2 rounded-md bg-[#2b2724] px-3 py-2 text-xs font-semibold text-white">Claim my code</div>
                <p className="mt-2 text-[9px] text-[#a09a93]">Double opt-in · unsubscribe anytime</p>
              </div>
            </div>
          </Card>
          <Card className="px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">This month</p>
            <p className="tabular mt-2 text-2xl font-semibold">2,189 signups</p>
            <p className="mt-1 text-xs text-[#006300]">↑ 5.9% vs June · best performer: Longevity Type quiz (19.1%)</p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
