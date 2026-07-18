import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/ui";
import { workspaceIsClean } from "@/lib/server/views";
import { ProspectsDemo } from "@/components/prospects-demo";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const clean = await workspaceIsClean();
  if (!clean) return <ProspectsDemo />;
  return (
    <Shell title="Prospect Discovery" subtitle="Fresh workspace · prospects appear as real sources connect">
      <Card className="px-6 py-12 text-center">
        <p className="text-2xl">✧</p>
        <h2 className="mt-2 text-base font-semibold">No prospects yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-2">
          Prospects arrive from popups, lead forms, uploads and (later) enrichment providers. Nothing here is faked in the clean workspace.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/imports" className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">Upload a lead file</Link>
          <Link href="/forms" className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">Activate a popup</Link>
        </div>
      </Card>
    </Shell>
  );
}
