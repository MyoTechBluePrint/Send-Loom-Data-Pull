"use client";

// The way into a new campaign: name it, subject it, land in the REAL editor.
//
// This page used to be the original Vitalis prototype builder — hard-coded
// demo brand, decorative audience dropdown, a "Staging · demo sends only"
// badge, and a save that kept only the name and subject while silently
// discarding every block placed. Sending is live now and this button is the
// first thing a new operator presses, so the mock is gone: two fields, one
// POST, straight into the editor every other screen already uses.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "@/components/shell";

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), subject: subject.trim() || undefined }),
      });
      const body = (await res.json()) as { ok?: boolean; id?: string };
      if (!res.ok || !body.id) {
        setError("The campaign could not be created. Try again.");
        setBusy(false);
        return;
      }
      router.push(`/campaigns/${body.id}/email`);
    } catch {
      setError("The campaign could not be created. Try again.");
      setBusy(false);
    }
  }

  return (
    <Shell title="New campaign" subtitle="Name it, then build the email in the editor">
      <div className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-6">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="campaign-name">
          Campaign name
        </label>
        <input
          id="campaign-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="September discount push"
          maxLength={140}
          autoFocus
          className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />

        <label className="mt-4 block text-sm font-medium text-zinc-700" htmlFor="campaign-subject">
          Subject line <span className="font-normal text-zinc-400">(you can change it later)</span>
        </label>
        <input
          id="campaign-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Your discount is inside"
          maxLength={200}
          className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={create}
            disabled={!name.trim() || busy}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create and open the editor"}
          </button>
          <Link href="/campaigns" className="text-sm text-zinc-500 hover:text-zinc-700">
            Cancel
          </Link>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-zinc-400">
          The editor has the blocks, brand styling, product feeds and the
          enforced unsubscribe footer. Audience and sending options live on the
          campaign page once the email is built.
        </p>
      </div>
    </Shell>
  );
}
