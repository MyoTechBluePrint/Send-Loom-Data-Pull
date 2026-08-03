"use client";

// The marketing tornado, visibly: a funnel of swirling contour rings drawn in
// brand blue behind the headline, with channel icons riding its ellipses.
// Icons animate along 8-point elliptical paths (translate-only keyframes, so
// glyphs never skew and stay upright); spacing comes from negative animation
// delays. The funnel itself swirls via animated dashed strokes. Pure CSS,
// honours prefers-reduced-motion.

const P = {
  mail: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 1 8 6 8-6",
  whatsapp: "M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zm-3.1 5.4c.2-.5.5-.5.7-.5h.6c.2 0 .5 0 .7.5s.8 1.9.8 2-.1.4-.2.5l-.5.6c-.1.2-.3.3-.1.6.2.4.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.4.3.2.5.1.6-.1l.8-.9c.2-.3.4-.2.7-.1l1.9.9c.3.2.5.2.5.4 0 .2 0 1-.4 1.6-.4.5-1.9 1.5-3.2 1.1-1.4-.4-3.1-1.2-4.6-2.9-1.5-1.6-2.3-3.2-2.5-4.1-.3-1.2.4-2.4.8-2.9z",
  telegram: "M21 4.5 3.7 11.2c-.8.3-.8.9-.1 1.1l4.4 1.4 1.7 5.2c.2.6.5.7 1 .3l2.5-2 4.5 3.3c.6.3 1 .1 1.2-.6L21.9 5.6c.2-.9-.3-1.4-.9-1.1zM8.5 13.5l9.4-5.9-7.7 6.8-.3 3-1.4-3.9z",
  instagram: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zm4 5.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zM17.2 6.2a.8.8 0 1 0 .8.8.8.8 0 0 0-.8-.8z",
  facebook: "M13.5 21v-8h2.7l.4-3h-3.1V8.2c0-.9.3-1.5 1.6-1.5h1.6V4.1C16.4 4 15.5 4 14.5 4 12.3 4 10.8 5.3 10.8 7.8V10H8v3h2.8v8h2.7z",
  google: "M12 11v3h4.4a4.6 4.6 0 1 1-1.1-4.7l2.2-2.2A7.7 7.7 0 1 0 19.7 12c0-.3 0-.7-.1-1z",
  googleAds: "M4.5 18.5 11 7l3.5 6-4.9 8.6A2.9 2.9 0 0 1 4.5 18.5zm15 0a2.9 2.9 0 0 1-5 2.9L9.6 12.9 13 7l6.5 11.5z",
  sms: "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1zm4 6.5h.01M12 10.5h.01M16 10.5h.01",
  cart: "M4 5h2l2 11h10l2-8H7M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H4",
  tag: "M3 12l9-9h7a1 1 0 0 1 1 1v7l-9 9a1 1 0 0 1-1.4 0L3 13.4A1 1 0 0 1 3 12zm13.5-5.5h.01",
};

/** [cy, rx, ry, durationSec, iconKeys] — one orbit lane per funnel level. */
const LANES: [number, number, number, number, (keyof typeof P)[]][] = [
  [120, 300, 72, 26, ["mail", "whatsapp", "instagram", "google", "chart", "facebook"]],
  [280, 205, 52, 20, ["telegram", "googleAds", "cart", "sms", "tag"]],
  [420, 115, 32, 15, ["google", "whatsapp", "mail"]],
];

const TINTS = ["#3478f6", "#6d7a92", "#5b93f8", "#1d4ed8"];

/** 8-point elliptical translate keyframes: orbits without skew. */
function orbitFrames(name: string, rx: number, ry: number): string {
  const steps = Array.from({ length: 9 }, (_, k) => {
    const t = (2 * Math.PI * k) / 8;
    return `${(k * 12.5).toFixed(1)}% { transform: translate(${(rx * Math.cos(t)).toFixed(1)}px, ${(ry * Math.sin(t)).toFixed(1)}px); }`;
  });
  return `@keyframes ${name} { ${steps.join(" ")} }`;
}

/** The funnel contours: ellipses narrowing to the ground. */
const CONTOURS = Array.from({ length: 8 }, (_, i) => {
  const cy = 110 + i * 52;
  const rx = 300 - i * 36;
  const ry = 74 - i * 8.6;
  return { cy, rx: Math.max(rx, 36), ry: Math.max(ry, 9), o: 0.34 - i * 0.025 };
});

export function TornadoBg() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      <style>{`
        ${LANES.map(([, rx, ry], i) => orbitFrames(`sl-lane-${i}`, rx, ry)).join("\n")}
        @keyframes sl-swirl { to { stroke-dashoffset: -320; } }
        @media (prefers-reduced-motion: reduce) { .sl-orbiter, .sl-contour { animation: none !important; } }
      `}</style>

      {/* Anchored behind the headline block */}
      <div className="absolute left-[4%] top-[-20px] h-[640px] w-[680px] max-w-full">
        {/* The funnel itself: solid cartoon-3D bands, dashes as motion streaks */}
        <svg viewBox="0 0 680 640" className="h-full w-full" fill="none">
          <defs>
            <linearGradient id="slBandA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dbe7fd" />
              <stop offset="55%" stopColor="#a8c4fb" />
              <stop offset="100%" stopColor="#6d9bf8" />
            </linearGradient>
            <linearGradient id="slBandB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c3d7fc" />
              <stop offset="60%" stopColor="#8fb4fa" />
              <stop offset="100%" stopColor="#5b93f8" />
            </linearGradient>
            <radialGradient id="slGlow" cx="0.5" cy="0.4" r="0.6">
              <stop offset="0%" stopColor="#3478f6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#3478f6" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient glow behind the twister */}
          <ellipse cx="340" cy="280" rx="330" ry="250" fill="url(#slGlow)" />

          {/* Ground shadow */}
          <ellipse cx="332" cy="580" rx="120" ry="16" fill="#1d4ed8" opacity="0.10" />

          {/* Body: bottom band first so upper bands overlap like a stacked twister */}
          {[...CONTOURS].reverse().map((c, ri) => {
            const i = CONTOURS.length - 1 - ri;
            return (
              <g key={i}>
                <ellipse
                  cx={340 + (i % 2 === 0 ? 8 : -10)}
                  cy={c.cy}
                  rx={c.rx}
                  ry={c.ry}
                  fill={i % 2 === 0 ? "url(#slBandA)" : "url(#slBandB)"}
                  fillOpacity={0.5 + i * 0.045}
                  stroke="#3478f6"
                  strokeOpacity="0.28"
                  strokeWidth="1.4"
                />
                {/* Cartoon highlight arc on each band's upper-left rim */}
                <path
                  d={`M ${340 + (i % 2 === 0 ? 8 : -10) - c.rx * 0.75} ${c.cy - c.ry * 0.35} Q ${340 + (i % 2 === 0 ? 8 : -10) - c.rx * 0.15} ${c.cy - c.ry * 1.25} ${340 + (i % 2 === 0 ? 8 : -10) + c.rx * 0.55} ${c.cy - c.ry * 0.7}`}
                  stroke="#ffffff"
                  strokeOpacity="0.55"
                  strokeWidth={i < 3 ? 3 : 2}
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Motion streaks: the dashes now ride ON the body */}
          {CONTOURS.map((c, i) => (
            <ellipse
              key={`d${i}`}
              className="sl-contour"
              cx={340 + (i % 2 === 0 ? 8 : -10)}
              cy={c.cy}
              rx={c.rx * 1.06}
              ry={c.ry * 1.15}
              stroke="#1d4ed8"
              strokeOpacity={0.22}
              strokeWidth="1.6"
              strokeDasharray={`${26 - i * 2} ${18 + i * 2}`}
              style={{ animation: `sl-swirl ${18 + i * 4}s linear infinite` }}
            />
          ))}

          {/* Ground wisp */}
          <path d="M300 565 q34 24 74 9 q-44 28 -88 13 q22 5 14 -22z" fill="#5b93f8" opacity="0.45" />
        </svg>

        {/* Icons riding the funnel lanes */}
        {LANES.map(([cy, , , duration, icons], li) => (
          <div key={li} className="absolute" style={{ left: 340, top: cy }}>
            {icons.map((key, i) => (
              <span
                key={`${key}${i}`}
                className="sl-orbiter absolute"
                style={{
                  animation: `sl-lane-${li} ${duration}s linear infinite`,
                  animationDelay: `${-(duration / icons.length) * i}s`,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width={li === 0 ? 30 : li === 1 ? 26 : 21}
                  height={li === 0 ? 30 : li === 1 ? 26 : 21}
                  fill="none"
                  stroke={TINTS[(li + i) % TINTS.length]}
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: 0.5 - li * 0.06, marginLeft: -12, marginTop: -12 }}
                >
                  <path d={P[key]} />
                </svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
