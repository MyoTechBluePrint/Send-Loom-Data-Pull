"use client";

// The campaign email editor page: loads the campaign's blocks, hands them to
// the shared editor, and wires save/preview/test back to the campaign API.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { EmailEditor } from "@/components/email-editor";

type Data = {
  campaign: {
    id: string; name: string; subject: string | null; status: string;
    content: string | null; contentDirty: boolean;
    templateId: string | null; templateName: string | null;
    brandId: string | null; sent: boolean;
  };
  brands: { id: string; name: string }[];
};

export default function CampaignEmailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  async function duplicateAndEdit() {
    setDuplicating(true);
    try {
      const j = await fetch(`/api/campaigns/${id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      }).then((r) => r.json());
      if (j.ok && j.id) {
        router.push(`/campaigns/${j.id}/email`);
        // Same route, new id: force the data reload the push alone won't trigger.
        setData(null);
        router.refresh();
      } else {
        setError(j.error ?? "Could not duplicate the campaign.");
        setDuplicating(false);
      }
    } catch {
      setError("Could not duplicate the campaign.");
      setDuplicating(false);
    }
  }

  useEffect(() => {
    fetch(`/api/campaigns/${id}/email`)
      .then((r) => r.json())
      .then((j) => (j.ok ? setData(j) : setError(j.error ?? "Could not load.")))
      .catch(() => setError("Could not load the campaign."));
  }, [id]);

  if (error) {
    return (
      <Shell title="Email editor" subtitle="Campaign email">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell title="Email editor" subtitle="Loading…">
        <div className="h-64 animate-pulse rounded-xl border border-line bg-black/[0.02]" />
      </Shell>
    );
  }

  const c = data.campaign;
  let blocks: { id: string; type: string }[] = [];
  try { blocks = c.content ? JSON.parse(c.content) : []; } catch { blocks = []; }

  return (
    <Shell
      title={`Email · ${c.name}`}
      subtitle={c.templateName ? `Based on template "${c.templateName}"${c.contentDirty ? " · edited since applied" : ""}` : "Custom email"}
      actions={
        <Link href={`/campaigns/${c.id}`} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">
          ← Back to campaign
        </Link>
      }
    >
      {c.sent && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
          <p className="text-[13px] text-amber-900">
            This campaign has been sent, so its content is locked as a historical record.
          </p>
          <button
            onClick={duplicateAndEdit}
            disabled={duplicating}
            className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {duplicating ? "Duplicating…" : "Duplicate and edit"}
          </button>
        </div>
      )}
      <EmailEditor
        initialBlocks={blocks as never}
        subject={c.subject ?? ""}
        brandId={c.brandId}
        brands={data.brands}
        previewUrl={`/api/campaigns/${c.id}/email`}
        readOnly={c.sent}
        onSave={async (content, subject, brandId) => {
          const r = await fetch(`/api/campaigns/${c.id}/email`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, subject, brandId }),
          });
          return r.json();
        }}
        onSendTest={async (to, content) => {
          const r = await fetch(`/api/campaigns/${c.id}/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "send_test", to, content }),
          });
          return r.json();
        }}
      />
    </Shell>
  );
}
