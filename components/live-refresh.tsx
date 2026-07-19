"use client";

// Install-day live mode: re-fetches the server-rendered page data on an
// interval so new tracker events appear without manual reloads. Defaults on;
// pauses itself when the tab is hidden to avoid pointless requests.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh({ seconds = 12 }: { seconds?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(true);

  useEffect(() => {
    if (!on) return;
    const tick = () => {
      if (!document.hidden) router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);
    return () => clearInterval(id);
  }, [on, seconds, router]);

  return (
    <button
      onClick={() => setOn(!on)}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold transition ${on ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-line text-ink-3 hover:bg-[#f0efec]"}`}
      title={on ? `Refreshing every ${seconds}s` : "Auto-refresh paused"}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "animate-pulse bg-emerald-500" : "bg-zinc-300"}`} />
      {on ? "Live" : "Paused"}
    </button>
  );
}
