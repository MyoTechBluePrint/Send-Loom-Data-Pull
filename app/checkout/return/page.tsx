"use client";

// Where the customer lands after checkout.
//
// Nothing on this page grants access. Access comes from the webhook, so the
// page polls the account's real state and says honestly when confirmation is
// still in flight rather than showing a success tick the backend has not agreed
// to yet.

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

type Status = {
  status?: string;
  planName?: string | null;
  amountLabel?: string | null;
  firstBillingLabel?: string | null;
  paymentMethod?: { verified: boolean; brand: string | null; last4: string | null };
  trial?: { daysLeft?: number } | null;
};

function ReturnInner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/billing/status");
        if (!res.ok) return;
        const j = (await res.json()) as Status;
        if (cancelled) return;
        setStatus(j);
        if (!j.paymentMethod?.verified && tries < 10) {
          setTimeout(() => setTries((n) => n + 1), 1500);
        }
      } catch {
        /* keep polling until the attempt budget runs out */
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [tries]);

  const verified = status?.paymentMethod?.verified;
  const stillWaiting = !verified && tries < 10;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 text-center shadow-sm">
        {stillWaiting && (
          <>
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-line border-t-brand" />
            <h1 className="mt-4 text-lg font-semibold">Confirming with your payment provider</h1>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">
              We are waiting for the provider to confirm before we change anything on your account.
              This usually takes a few seconds.
            </p>
          </>
        )}

        {verified && (
          <>
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] text-lg text-white">✓</div>
            <h1 className="mt-4 text-lg font-semibold">Your payment method is verified</h1>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">
              <strong>£0.00 was taken today.</strong> Your card was verified only.
            </p>

            <dl className="mt-5 space-y-2 rounded-xl border border-line bg-[#faf9f7] p-4 text-left">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-ink-3">Plan</dt>
                <dd className="text-sm font-semibold">{status?.planName ?? "Selected"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-ink-3">Monthly amount</dt>
                <dd className="text-sm font-medium">{status?.amountLabel ?? "Shown in billing"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-ink-3">First payment</dt>
                <dd className="text-right text-sm font-medium">{status?.firstBillingLabel ?? "At the end of your trial"}</dd>
              </div>
              {status?.paymentMethod?.last4 && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-ink-3">Payment method</dt>
                  <dd className="text-sm font-medium capitalize">
                    {status.paymentMethod.brand} ending {status.paymentMethod.last4}
                  </dd>
                </div>
              )}
            </dl>

            <p className="mt-4 text-[11px] leading-relaxed text-ink-3">
              You keep full access for the rest of your free trial. Cancel before{" "}
              {status?.firstBillingLabel ?? "your first payment"} and you will not be charged.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/"
                className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2.5 text-sm font-semibold text-white transition hover:from-[#6d28d9] hover:to-[#4c1d95]"
              >
                Back to SendLoom
              </Link>
              <Link href="/settings/billing" className="text-xs font-medium text-ink-3 hover:text-brand">Manage billing</Link>
            </div>
          </>
        )}

        {!verified && !stillWaiting && (
          <>
            <h1 className="text-lg font-semibold">We have not had confirmation yet</h1>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">
              Your payment provider has not confirmed this yet, so we have not changed your account.
              Nothing has been charged. If you completed checkout, this usually resolves within a
              minute or two and your billing page will update on its own.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link href="/settings/billing" className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink-2 hover:border-brand hover:text-brand">
                Check billing status
              </Link>
              <Link href="/plans" className="text-xs font-medium text-ink-3 hover:text-brand">Try choosing a plan again</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutReturnPage() {
  return (
    <Suspense>
      <ReturnInner />
    </Suspense>
  );
}
