"use client";

// First-login walkthrough. Shows once (localStorage flag); restartable from
// the user menu or the handover page.
import Link from "next/link";
import { useEffect, useState } from "react";

const STEPS = [
  { title: "Dashboard", href: "/", copy: "This is your daily command centre: what changed, who needs follow-up, and the next best actions with the reasons behind them." },
  { title: "Universal Inbox & Data Uploads", href: "/inbox", copy: "Paste, upload or forward messy data here. Sendloom extracts names, numbers and interests, then you approve what becomes a contact." },
  { title: "Contacts", href: "/subscribers", copy: "Every person has a source ledger (where they came from), a timeline and a lead score with visible reasons." },
  { title: "Audience Builder", href: "/segments", copy: "Turn contacts into useful groups with live estimates, then launch campaigns at them." },
  { title: "Demand Radar", href: "/demand", copy: "See what people are searching for, which topics are rising, and where demand has no matching product yet." },
  { title: "Prospect Discovery", href: "/prospects", copy: "Review potential leads by source, interest, score and whether you're actually allowed to contact them." },
  { title: "Sales Tasks", href: "/tasks", copy: "Follow up the leads that need a human: calls, WhatsApps and reviews, created by the platform's intelligence." },
  { title: "Analytics", href: "/analytics", copy: "See which sources, audiences and campaigns make money. Revenue attribution is the point of all of this." },
];

export const WALKTHROUGH_KEY = "sendloom_walkthrough_done";

export function Walkthrough() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(WALKTHROUGH_KEY)) setStep(0);
    const onRestart = () => setStep(0);
    window.addEventListener("sendloom:walkthrough", onRestart);
    return () => window.removeEventListener("sendloom:walkthrough", onRestart);
  }, []);

  if (step === null) return null;
  const finish = () => {
    localStorage.setItem(WALKTHROUGH_KEY, "1");
    setStep(null);
  };
  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand">Welcome to Sendloom · {step + 1} of {STEPS.length}</p>
          <button onClick={finish} className="text-xs font-semibold text-ink-3 hover:text-foreground">Skip</button>
        </div>
        <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{s.copy}</p>
        <div className="mt-3">
          <Link href={s.href} onClick={finish} className="text-[13px] font-semibold text-brand hover:underline">
            Take me there →
          </Link>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-brand" : "bg-[#e1e0d9]"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec]">
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#5b21b6]">
                Next
              </button>
            ) : (
              <button onClick={finish} className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#5b21b6]">
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
