"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Sign-in failed.");
        return;
      }
      router.push(params.get("next") ?? "/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#14121f] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <img src="/logo.png" alt="Sendloom logo" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5" />
          <div>
            <p className="text-base font-semibold leading-tight text-white">Sendloom</p>
            <p className="text-[11px] text-white/50">Growth Intelligence OS · staging</p>
          </div>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white p-6 shadow-xl">
          <h1 className="text-base font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-ink-3">Staging access is by invitation. Use demo data only.</p>
          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}
          <label className="mt-4 block">
            <span className="text-xs font-medium text-ink-3">Email</span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">Password</span>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-3.5 w-3.5 accent-[#6d28d9]" />
            Keep me signed in for 30 days
          </label>
          <button
            type="submit" disabled={busy}
            className="mt-5 w-full rounded-lg bg-[#6d28d9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-4 text-center text-[11px] text-ink-3">No password reset yet · ask Steve if you're locked out</p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
