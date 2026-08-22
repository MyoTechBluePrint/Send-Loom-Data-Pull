"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Subscriber } from "@/lib/data";

// Marketing & Communication Preferences, on the profile.
//
// Three rows, one per channel, changed in place: tap the state you want and
// it is recorded through the same door as every other consent change, with
// this user's name on the ledger row. Deliberately compact — the compliance
// story lives in the ledger and the timeline, not on this card.

const STATES = [
  ["granted", "Consented"],
  ["declined", "Not consented"],
  ["unknown", "Unknown"],
] as const;

const LABELS: Record<string, string> = {
  granted: "Consented",
  declined: "Not consented",
  pending: "Unknown",
  unknown: "Unknown",
  withdrawn: "Unsubscribed",
  suppressed: "Suppressed",
};

export function ConsentPreferences({ sub }: { sub: Subscriber }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const set = async (channel: "email" | "sms" | "whatsapp", status: string) => {
    setBusy(channel);
    try {
      await fetch(`/api/contacts/${sub.id}/consent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: [channel], status }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const setDnc = async (value: boolean) => {
    setBusy("dnc");
    try {
      await fetch(`/api/contacts/${sub.id}/consent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doNotContact: value }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const rows: ["email" | "sms" | "whatsapp", string, string][] = [
    ["email", "Email marketing", sub.channelStates.email],
    ["sms", "SMS marketing", sub.channelStates.sms],
    ["whatsapp", "WhatsApp marketing", sub.channelStates.whatsapp],
  ];

  return (
    <div className="px-5 py-4">
      {sub.doNotContact && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          Do Not Contact is on: all marketing to this contact is blocked, whatever the channels below say.
        </p>
      )}

      <div className="space-y-2.5">
        {rows.map(([channel, label, state]) => (
          <div key={channel} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{label}</p>
              <p className={`text-[11px] font-semibold ${
                state === "granted" ? "text-emerald-700"
                : state === "withdrawn" || state === "suppressed" ? "text-red-600"
                : state === "declined" ? "text-amber-700"
                : "text-ink-3"
              }`}>{LABELS[state] ?? state}</p>
            </div>
            <div className="flex gap-1">
              {STATES.map(([value, word]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy === channel}
                  onClick={() => set(channel, value)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ${
                    (state === value || (value === "unknown" && (state === "pending" || state === "unknown")))
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line text-ink-3 hover:bg-[#f0efec]"
                  }`}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div>
          <p className="text-[13px] font-medium">Do Not Contact</p>
          <p className="text-[11px] text-ink-3">Blocks every marketing channel at send time</p>
        </div>
        <button
          type="button"
          disabled={busy === "dnc"}
          onClick={() => setDnc(!sub.doNotContact)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
            sub.doNotContact
              ? "border-red-200 bg-red-600 text-white hover:bg-red-700"
              : "border-line text-ink-2 hover:bg-[#f0efec]"
          }`}
        >
          {sub.doNotContact ? "On · remove block" : "Off"}
        </button>
      </div>

      {(sub.consentSource || sub.consentAt || sub.consentUpdatedBy) && (
        <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-ink-3">
          Last consent change{sub.consentAt ? ` ${sub.consentAt}` : ""}
          {sub.consentSource ? ` · ${sub.consentSource}` : ""}
          {sub.consentUpdatedBy ? ` · by ${sub.consentUpdatedBy}` : ""}
        </p>
      )}
    </div>
  );
}
