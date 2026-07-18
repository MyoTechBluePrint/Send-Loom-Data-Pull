import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,11,11,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700 border-emerald-200",
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  subscribed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  sending: "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
  unsubscribed: "bg-zinc-100 text-zinc-600 border-zinc-200",
  suppressed: "bg-red-50 text-red-700 border-red-200",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  const style = badgeStyles[value] ?? "bg-zinc-100 text-zinc-600 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${style}`}>
      {label ?? value}
    </span>
  );
}

export function Stat({ label, value, delta, deltaGood = true, hint }: { label: string; value: string; delta?: string; deltaGood?: boolean; hint?: string }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      {delta && (
        <p className={`mt-1 text-xs font-medium ${deltaGood ? "text-[#006300]" : "text-[#d03b3b]"}`}>
          {delta} <span className="font-normal text-ink-3">{hint ?? "vs last 30 days"}</span>
        </p>
      )}
    </Card>
  );
}

// Grouped line chart: two series over weeks. Pure SVG, hairline grid, direct labels.
export function RevenueChart({ weeks, a, b, labels }: { weeks: string[]; a: number[]; b: number[]; labels: [string, string] }) {
  const W = 720;
  const H = 220;
  const P = { t: 16, r: 96, b: 28, l: 44 };
  const max = Math.max(...a, ...b) * 1.12;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (weeks.length - 1);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const path = (s: number[]) => s.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [0, max / 3, (2 * max) / 3, max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Attributed revenue by week: ${labels[0]} and ${labels[1]}`}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
          <text x={P.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-3)" className="tabular">
            {t >= 1000 ? `£${Math.round(t / 1000)}k` : "£0"}
          </text>
        </g>
      ))}
      {weeks.map((w, i) =>
        i % 2 === 0 ? (
          <text key={w} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--ink-3)">
            {w}
          </text>
        ) : null
      )}
      <path d={path(b)} fill="none" stroke="var(--s2)" strokeWidth="2" strokeLinejoin="round" />
      <path d={path(a)} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(a.length - 1)} cy={y(a[a.length - 1])} r="4" fill="var(--s1)" stroke="var(--surface)" strokeWidth="2" />
      <circle cx={x(b.length - 1)} cy={y(b[b.length - 1])} r="4" fill="var(--s2)" stroke="var(--surface)" strokeWidth="2" />
      <text x={x(a.length - 1) + 10} y={y(a[a.length - 1]) + 3.5} fontSize="11" fontWeight="600" fill="var(--ink-2)">
        {labels[0]}
      </text>
      <text x={x(b.length - 1) + 10} y={y(b[b.length - 1]) + 3.5} fontSize="11" fontWeight="600" fill="var(--ink-2)">
        {labels[1]}
      </text>
    </svg>
  );
}

// Horizontal bar chart with 4px rounded data ends and direct value labels.
export function HBarChart({ items, format }: { items: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 flex-1 truncate font-medium text-ink-2">{it.label}</span>
            <span className="tabular shrink-0 whitespace-nowrap font-semibold">{format(it.value)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#f0efec]">
            <div className="h-2 rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: "var(--s1)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ data, color = "var(--s1)" }: { data: number[]; color?: string }) {
  const W = 96;
  const H = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const x = (i: number) => (i * W) / (data.length - 1);
  const y = (v: number) => H - 3 - ((v - min) / (max - min || 1)) * (H - 6);
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-24" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-3 ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}
