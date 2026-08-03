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
      <rect x="1.5" y="5.5" width="21" height="13" rx="6.5" fill="#7F54B3" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="7.2" fontWeight="800" fontFamily="Helvetica, Arial" fill="#fff">Woo</text>
    </>
  ),
  shopify: (
    <Chip>
      <path fill="#95BF47" d="M14.8 6.1c-.2-.1-.4 0-.5 0l-.7.2c-.2-.5-.5-1-1-1.4-.5-.4-1-.4-1.4-.3-1 .3-1.9 1.4-2.4 2.7l-1.5.5c-.4.1-.5.2-.5.6L5.6 17l8 1.5 3.2-13.2c-.7-.1-1.4.4-2 .8zm-3.2.3c.3.3.5.7.7 1.1l-1.9.6c.3-.8.7-1.4 1.2-1.7zm-1.4 6.2c.1 1 1.5 1.1 1.6 2.2.1.9-.7 1.6-1.8 1.5-.9-.1-1.5-.5-1.5-.5l.3-1s.6.4 1.1.4c.4 0 .5-.3.5-.4-.1-1.2-1.3-1-1.4-2.4-.1-1.4 1-2.6 2.7-2.5.6 0 .9.2.9.2l-.4 1.2s-.4-.2-.9-.2c-.9 0-1.1.7-1.1 1z" />
    </Chip>
  ),
  youtube: (
    <>
      <rect x="1.5" y="5.5" width="21" height="13" rx="4.5" fill="#FF0000" />
      <path fill="#fff" d="M10 9l6 3-6 3z" />
    </>
  ),
  linkedin: (
    <Chip bg="#0A66C2">
      <text x="12" y="15.6" textAnchor="middle" fontSize="9" fontWeight="800" fontFamily="Helvetica, Arial" fill="#fff">in</text>
    </Chip>
  ),
  tiktok: (
    <Chip bg="#010101">
      <path fill="#fff" d="M14.5 5c.4 1.6 1.5 2.7 3.1 3v2.4c-1.2 0-2.2-.4-3.1-1v4.7a4.3 4.3 0 1 1-4.3-4.3c.2 0 .5 0 .7.1v2.5a1.9 1.9 0 1 0 1.2 1.8V5h2.4z" />
    </Chip>
  ),
  stripe: (
    <Chip bg="#635BFF">
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="800" fontFamily="Helvetica, Arial" fill="#fff">S</text>
    </Chip>
  ),
  sms: (
    <Chip bg="#3478f6">
      <path fill="#fff" d="M6 7.5h12a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-7.5L7 18.5V15.5H6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
      <circle cx="9.5" cy="11.5" r="0.9" fill="#3478f6" /><circle cx="12.5" cy="11.5" r="0.9" fill="#3478f6" /><circle cx="15.5" cy="11.5" r="0.9" fill="#3478f6" />
    </Chip>
  ),
};

/** [cy, rx, ry, durationSec, brand keys] — orbits sized to the slender funnel. */
const LANES: [number, number, number, number, string[]][] = [
  [74, 210, 47, 24, ["gmail", "whatsapp", "instagram", "google", "facebook", "youtube"]],
  [250, 124, 30, 17, ["telegram", "googleAds", "woo", "shopify", "linkedin"]],
  [410, 58, 16, 12, ["sms", "tiktok", "stripe"]],
];

function orbitFrames(name: string, rx: number, ry: number): string {
  const steps = Array.from({ length: 9 }, (_, k) => {
    const t = (2 * Math.PI * k) / 8;
    return `${(k * 12.5).toFixed(1)}% { transform: translate(${(rx * Math.cos(t)).toFixed(1)}px, ${(ry * Math.sin(t)).toFixed(1)}px); }`;
  });
  return `@keyframes ${name} { ${steps.join(" ")} }`;
}

/** Smooth funnel geometry: a continuously curving spine with a taper.
 * Everything (edges, wraps, sheen, dust, orbit lanes) derives from these two
 * functions, so the silhouette can never kink. */
const TOP_Y = 72;
const TIP_Y = 548;
const spineX = (y: number) => {
  const t = (y - TOP_Y) / (TIP_Y - TOP_Y);
  return 230 - 100 * t * t; // gentle, accelerating lean to the left
};
const halfW = (y: number) => {
  const t = (y - TOP_Y) / (TIP_Y - TOP_Y);
  return 200 * Math.pow(1 - t, 1.4) + 7;
};

/** Catmull-Rom through points → smooth cubic path (no corners, ever). */
function smooth(pts: [number, number][]): string {
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const SAMPLE_YS = [72, 140, 210, 280, 350, 420, 480, 530, 548];
const LEFT: [number, number][] = SAMPLE_YS.map((y) => [spineX(y) - halfW(y), y]);
const RIGHT: [number, number][] = [...SAMPLE_YS].reverse().map((y) => [spineX(y) + halfW(y), y]);

const BODY_PATH = (() => {
  const down = smooth(LEFT);
  const tip = `Q ${spineX(TIP_Y).toFixed(1)} ${(TIP_Y + 18).toFixed(1)} ${(spineX(TIP_Y) + halfW(TIP_Y)).toFixed(1)} ${TIP_Y}`;
  const up = smooth(RIGHT).replace(/^M [\d.]+ [\d.]+/, "");
  const mouth = `C ${RIGHT[RIGHT.length - 1][0].toFixed(1)} ${TOP_Y - 46} ${LEFT[0][0].toFixed(1)} ${TOP_Y - 46} ${LEFT[0][0].toFixed(1)} ${TOP_Y}`;
  return `${down} ${tip}${up} ${mouth} Z`;
})();

const WRAP_YS = [150, 235, 320, 405, 475];

export function TornadoBg() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-visible lg:block">
      <style>{`
        ${LANES.map(([, rx, ry], i) => orbitFrames(`sl-lane-${i}`, rx, ry)).join("\n")}
        @keyframes sl-sway { 0%,100% { transform: rotate(-4.2deg) translateX(-14px); } 50% { transform: rotate(4.2deg) translateX(14px); } }
        @media (prefers-reduced-motion: reduce) { .sl-orbiter, .sl-body { animation: none !important; } }
      `}</style>

      {/* Sits in the whitespace between the copy and the card, never on text */}
      <div className="absolute left-[23%] top-[-70px] h-[880px] w-[680px]">
        <svg
          viewBox="0 0 460 620"
          className="sl-body h-full w-full opacity-[0.52]"
          style={{ animationName: "sl-sway", animationDuration: "12s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", transformOrigin: "50% 12%" }}
          fill="none"
        >
          <defs>
            <linearGradient id="slCone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b7cefc" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#8fb4fa" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#5b93f8" stopOpacity="0.85" />
            </linearGradient>
            <radialGradient id="slGlow" cx="0.5" cy="0.35" r="0.65">
              <stop offset="0%" stopColor="#3478f6" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#3478f6" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx="230" cy="240" rx="230" ry="240" fill="url(#slGlow)" />

          {/* Body: concave sides sweeping to a thin spout — the tornado shape */}
          <path
            d={BODY_PATH}
            fill="url(#slCone)"
            stroke="#3478f6"
            strokeOpacity="0.4"
            strokeWidth="2"
          />

          {/* Open mouth with interior depth */}
          <ellipse cx={spineX(TOP_Y)} cy={TOP_Y} rx={halfW(TOP_Y)} ry="42" fill="#2c63d9" opacity="0.32" />
          <ellipse cx={spineX(TOP_Y)} cy={TOP_Y + 4} rx={halfW(TOP_Y) * 0.8} ry="30" fill="#1d4ed8" opacity="0.18" />
          <ellipse cx={spineX(TOP_Y)} cy={TOP_Y} rx={halfW(TOP_Y)} ry="42" fill="none" stroke="#3478f6" strokeOpacity="0.55" strokeWidth="2.4" />

          {/* Wrap lines: front arcs only, tighter as it narrows */}
          {WRAP_YS.map((y, i) => (
            <path
              key={i}
              d={`M ${spineX(y) - halfW(y) * 0.97} ${y} Q ${spineX(y)} ${y + halfW(y) * 0.34 + 14} ${spineX(y) + halfW(y) * 0.97} ${y}`}
              stroke="#1d4ed8"
              strokeOpacity={0.3 - i * 0.035}
              strokeWidth={2.4 - i * 0.25}
              strokeLinecap="round"
            />
          ))}

          {/* Sheen down the left flank */}
          <path
            d={smooth([140, 240, 340, 440, 505].map((y) => [spineX(y) - halfW(y) * 0.55, y]) as [number, number][])}
            fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round"
          />

          {/* Dust at touch-down */}
          <ellipse cx={spineX(TIP_Y)} cy={TIP_Y + 16} rx="46" ry="8" fill="#5b93f8" opacity="0.22" />
          <ellipse cx={spineX(TIP_Y) + 6} cy={TIP_Y + 22} rx="82" ry="6" fill="#1d4ed8" opacity="0.08" />
          {[[spineX(TIP_Y) - 52, 534, 3.2], [spineX(TIP_Y) + 54, 528, 2.8]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#5b93f8" opacity={0.3 - i * 0.08} />
          ))}
        </svg>

        {/* Brand chips riding the funnel */}
        {LANES.map(([cy, , , duration, icons], li) => (
          <div key={li} className="absolute" style={{ left: spineX(cy), top: cy }}>
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
                  width={li === 0 ? 40 : li === 1 ? 33 : 27}
                  height={li === 0 ? 40 : li === 1 ? 33 : 27}
                  style={{ opacity: 0.95 - li * 0.05, marginLeft: -17, marginTop: -17 }}
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
