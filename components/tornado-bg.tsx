"use client";

// The marketing tornado, final form: a coiled ribbon twister (thick gradient
// arc strokes with round caps, swaying spine) with REAL channel marks — brand
// colours on white app-icon chips — orbiting its lanes. Orbits are 8-point
// translate keyframes (never skewed), spaced by negative delays. Pure CSS,
// honours prefers-reduced-motion.

import type { ReactNode } from "react";

/** Official-colour brand chips, drawn as compact 24x24 marks. */
function Chip({ children, bg = "#ffffff" }: { children: ReactNode; bg?: string }) {
  return (
    <>
      <circle cx="12" cy="12" r="11.5" fill={bg} stroke="rgba(20,18,31,0.08)" />
      {children}
    </>
  );
}

const BRANDS: Record<string, ReactNode> = {
  whatsapp: (
    <Chip bg="#25D366">
      <path fill="#fff" d="M8.7 7.3c.3-.7 1-.8 1.3-.1l.8 1.7c.2.4.1.8-.2 1.1l-.7.7c.6 1.3 1.7 2.4 3 3l.7-.7c.3-.3.7-.4 1.1-.2l1.7.8c.7.3.7 1 0 1.3-1 .6-2.2.8-3.4.3-2.1-.8-3.8-2.5-4.6-4.6-.5-1.1-.3-2.3.3-3.3z" />
    </Chip>
  ),
  telegram: (
    <Chip bg="#229ED9">
      <path fill="#fff" d="M17.4 7.4 6.9 11.5c-.5.2-.5.6 0 .8l2.6.8 1 3.1c.2.4.4.5.7.2l1.5-1.2 2.7 2c.3.2.7.1.8-.4l1.9-8.7c.1-.6-.2-.9-.7-.7zM10 13l6-4-4.8 4.4-.2 2.2-1-2.6z" />
    </Chip>
  ),
  instagram: (
    <>
      <defs>
        <radialGradient id="slIg" cx="0.3" cy="1.1" r="1.3">
          <stop offset="0%" stopColor="#FFDC80" />
          <stop offset="30%" stopColor="#F77737" />
          <stop offset="60%" stopColor="#E1306C" />
          <stop offset="100%" stopColor="#833AB4" />
        </radialGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="url(#slIg)" />
      <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="16.2" cy="7.8" r="1" fill="#fff" />
    </>
  ),
  facebook: (
    <Chip bg="#1877F2">
      <path fill="#fff" d="M13.2 19.5v-6h2.1l.3-2.4h-2.4V9.5c0-.7.2-1.2 1.2-1.2h1.3V6.2c-.2 0-1-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.9H8.7v2.4h2.2v6h2.3z" />
    </Chip>
  ),
  google: (
    <Chip>
      <path fill="#EA4335" d="M12 7.6c1.3 0 2.4.4 3.3 1.3l2.4-2.4C16.2 5.1 14.3 4.3 12 4.3 8.6 4.3 5.7 6.2 4.3 9l2.9 2.2c.7-2.1 2.6-3.6 4.8-3.6z" />
      <path fill="#4285F4" d="M19.6 12.2c0-.6-.1-1.1-.2-1.6H12v3.2h4.3c-.2 1-.8 1.9-1.7 2.5l2.8 2.1c1.6-1.5 2.2-3.7 2.2-6.2z" />
      <path fill="#FBBC05" d="M7.2 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L4.3 8c-.6 1.2-1 2.6-1 4s.4 2.8 1 4l2.9-2.1z" />
      <path fill="#34A853" d="M12 19.7c2.3 0 4.2-.7 5.6-2l-2.8-2.1c-.8.5-1.7.8-2.8.8-2.2 0-4.1-1.5-4.8-3.5L4.3 15c1.4 2.8 4.3 4.7 7.7 4.7z" />
    </Chip>
  ),
  googleAds: (
    <Chip>
      <path fill="#FBBC04" d="M6.3 15.7 11 7.5c.5-.9 1.6-1.2 2.5-.7L8.8 16.3c-.5.9-1.6 1.2-2.5.7-.9-.5-1.2-1.6 0-1.3z" />
      <path fill="#4285F4" d="M13.5 6.8c.9-.5 2-.2 2.5.7l4.2 7.3c.5.9.2 2-.7 2.5-.9.5-2 .2-2.5-.7l-4.2-7.3c-.5-.9-.2-2 .7-2.5z" />
      <circle cx="7.5" cy="17.2" r="1.9" fill="#34A853" />
    </Chip>
  ),
  gmail: (
    <Chip>
      <path fill="#EA4335" d="M5 8.2v9h2.6v-6.4L12 14l4.4-3.2v6.4H19v-9l-7 5-7-5z" />
      <path fill="#4285F4" d="M5 8.2 12 13l7-4.8V7.4c0-.9-1-1.4-1.7-.9L12 10.3 6.7 6.5C6 6 5 6.5 5 7.4v.8z" />
    </Chip>
  ),
  woo: (
    <>
      <rect x="1.5" y="4.5" width="21" height="15" rx="4" fill="#7F54B3" />
      <text x="12" y="15.6" textAnchor="middle" fontSize="9.5" fontWeight="800" fontFamily="Helvetica, Arial" fill="#fff">W</text>
    </>
  ),
  shopify: (
    <Chip>
      <path fill="#95BF47" d="M14.8 6.1c-.2-.1-.4 0-.5 0l-.7.2c-.2-.5-.5-1-1-1.4-.5-.4-1-.4-1.4-.3-1 .3-1.9 1.4-2.4 2.7l-1.5.5c-.4.1-.5.2-.5.6L5.6 17l8 1.5 3.2-13.2c-.7-.1-1.4.4-2 .8zm-3.2.3c.3.3.5.7.7 1.1l-1.9.6c.3-.8.7-1.4 1.2-1.7zm-1.4 6.2c.1 1 1.5 1.1 1.6 2.2.1.9-.7 1.6-1.8 1.5-.9-.1-1.5-.5-1.5-.5l.3-1s.6.4 1.1.4c.4 0 .5-.3.5-.4-.1-1.2-1.3-1-1.4-2.4-.1-1.4 1-2.6 2.7-2.5.6 0 .9.2.9.2l-.4 1.2s-.4-.2-.9-.2c-.9 0-1.1.7-1.1 1z" />
    </Chip>
  ),
  sms: (
    <Chip bg="#3478f6">
      <path fill="#fff" d="M6 7.5h12a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-7.5L7 18.5V15.5H6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
      <circle cx="9.5" cy="11.5" r="0.9" fill="#3478f6" /><circle cx="12.5" cy="11.5" r="0.9" fill="#3478f6" /><circle cx="15.5" cy="11.5" r="0.9" fill="#3478f6" />
    </Chip>
  ),
};

/** [cy, rx, ry, durationSec, brand keys] — one orbit lane per funnel level. */
const LANES: [number, number, number, number, string[]][] = [
  [120, 305, 74, 28, ["gmail", "whatsapp", "instagram", "google", "facebook"]],
  [280, 208, 54, 21, ["telegram", "googleAds", "woo", "shopify"]],
  [420, 118, 33, 15, ["sms", "whatsapp", "google"]],
];

function orbitFrames(name: string, rx: number, ry: number): string {
  const steps = Array.from({ length: 9 }, (_, k) => {
    const t = (2 * Math.PI * k) / 8;
    return `${(k * 12.5).toFixed(1)}% { transform: translate(${(rx * Math.cos(t)).toFixed(1)}px, ${(ry * Math.sin(t)).toFixed(1)}px); }`;
  });
  return `@keyframes ${name} { ${steps.join(" ")} }`;
}

/** Ribbon coils: swaying spine, tapering widths. */
const COILS = Array.from({ length: 9 }, (_, i) => {
  const t = i / 8;
  return {
    cx: 340 + Math.sin(i * 0.9) * 24 - i * 10,
    cy: 108 + i * 50,
    rx: 300 - i * 31,
    ry: 72 - i * 7.4,
    w: 30 - i * 2.6,
    o: 0.85 - t * 0.25,
  };
});

export function TornadoBg() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      <style>{`
        ${LANES.map(([, rx, ry], i) => orbitFrames(`sl-lane-${i}`, rx, ry)).join("\n")}
        @keyframes sl-swirl { to { stroke-dashoffset: -320; } }
        @keyframes sl-sway { 0%,100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
        @media (prefers-reduced-motion: reduce) { .sl-orbiter, .sl-contour, .sl-body { animation: none !important; } }
      `}</style>

      <div className="absolute left-[4%] top-[-20px] h-[640px] w-[680px] max-w-full">
        <svg viewBox="0 0 680 640" className="sl-body h-full w-full" style={{ animation: "sl-sway 9s ease-in-out infinite", transformOrigin: "50% 20%" }} fill="none">
          <defs>
            <linearGradient id="slRib" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8fb4fa" />
              <stop offset="45%" stopColor="#5b93f8" />
              <stop offset="100%" stopColor="#2c63d9" />
            </linearGradient>
            <linearGradient id="slRib2" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#b7cefc" />
              <stop offset="55%" stopColor="#6d9bf8" />
              <stop offset="100%" stopColor="#3478f6" />
            </linearGradient>
            <radialGradient id="slGlow" cx="0.5" cy="0.38" r="0.62">
              <stop offset="0%" stopColor="#3478f6" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#3478f6" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx="340" cy="280" rx="330" ry="255" fill="url(#slGlow)" />
          <ellipse cx="268" cy="588" rx="120" ry="15" fill="#1d4ed8" opacity="0.12" />

          {/* The coil: thick open arcs with round caps, alternating direction */}
          {COILS.map((c, i) => {
            const sweepLeft = i % 2 === 0;
            const x1 = c.cx - c.rx * (sweepLeft ? 0.96 : 0.88);
            const x2 = c.cx + c.rx * (sweepLeft ? 0.88 : 0.96);
            const bulge = c.ry * 2.05;
            return (
              <g key={i}>
                <path
                  d={`M ${x1} ${c.cy} Q ${c.cx} ${c.cy + (sweepLeft ? bulge : -bulge)} ${x2} ${c.cy}`}
                  stroke={sweepLeft ? "url(#slRib)" : "url(#slRib2)"}
                  strokeOpacity={c.o}
                  strokeWidth={c.w}
                  strokeLinecap="round"
                />
                {/* Rim light along the top of each coil */}
                <path
                  d={`M ${x1 + 14} ${c.cy - c.w * 0.28} Q ${c.cx} ${c.cy + (sweepLeft ? bulge : -bulge) - c.w * 0.3} ${x2 - 18} ${c.cy - c.w * 0.28}`}
                  stroke="#ffffff"
                  strokeOpacity={0.4}
                  strokeWidth={Math.max(2, c.w * 0.16)}
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Motion streaks */}
          {COILS.filter((_, i) => i % 2 === 0).map((c, i) => (
            <ellipse
              key={`d${i}`}
              className="sl-contour"
              cx={c.cx} cy={c.cy} rx={c.rx * 1.12} ry={c.ry * 1.2}
              stroke="#1d4ed8" strokeOpacity="0.18" strokeWidth="1.6"
              strokeDasharray={`${24 - i * 3} ${18 + i * 3}`}
              style={{ animation: `sl-swirl ${16 + i * 5}s linear infinite` }}
            />
          ))}

          {/* Debris flecks near the base */}
          {[[214, 528, 5], [420, 505, 4], [180, 470, 3.4], [452, 452, 3]].map(([x, y, r], i) => (
            <circle key={`f${i}`} cx={x} cy={y} r={r} fill="#5b93f8" opacity={0.5 - i * 0.08} />
          ))}
        </svg>

        {/* Real brand chips riding the lanes */}
        {LANES.map(([cy, , , duration, icons], li) => (
          <div key={li} className="absolute" style={{ left: 340 - li * 10, top: cy }}>
            {icons.map((key, i) => (
              <span
                key={`${key}${i}`}
                className="sl-orbiter absolute"
                style={{
                  animationName: `sl-lane-${li}`,
                  animationDuration: `${duration}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  animationDelay: `${-(duration / icons.length) * i}s`,
                  filter: "drop-shadow(0 3px 6px rgba(20,18,31,0.18))",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width={li === 0 ? 34 : li === 1 ? 29 : 24}
                  height={li === 0 ? 34 : li === 1 ? 29 : 24}
                  style={{ opacity: 0.95 - li * 0.06, marginLeft: -14, marginTop: -14 }}
                >
                  {BRANDS[key]}
                </svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
