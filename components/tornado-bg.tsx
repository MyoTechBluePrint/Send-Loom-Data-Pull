"use client";

// The marketing tornado: every channel SendLoom touches, orbiting in a faint
// funnel behind the hero. Three elliptical rings, narrower and faster toward
// the bottom, icons counter-rotated so they stay upright. Pure CSS animation,
// paused for prefers-reduced-motion, and everything sits at whisper opacity so
// the headline and subscription card stay in charge.

const P = {
  mail: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 1 8 6 8-6",
  whatsapp: "M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zm-3.1 5.4c.2-.5.5-.5.7-.5h.6c.2 0 .5 0 .7.5s.8 1.9.8 2-.1.4-.2.5l-.5.6c-.1.2-.3.3-.1.6.2.4.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.4.3.2.5.1.6-.1l.8-.9c.2-.3.4-.2.7-.1l1.9.9c.3.2.5.2.5.4 0 .2 0 1-.4 1.6-.4.5-1.9 1.5-3.2 1.1-1.4-.4-3.1-1.2-4.6-2.9-1.5-1.6-2.3-3.2-2.5-4.1-.3-1.2.4-2.4.8-2.9z",
  telegram: "M21 4.5 3.7 11.2c-.8.3-.8.9-.1 1.1l4.4 1.4 1.7 5.2c.2.6.5.7 1 .3l2.5-2 4.5 3.3c.6.3 1 .1 1.2-.6L21.9 5.6c.2-.9-.3-1.4-.9-1.1zM8.5 13.5l9.4-5.9-7.7 6.8-.3 3-1.4-3.9z",
  instagram: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zm4 5.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zM17.2 6.2a.8.8 0 1 0 .8.8.8.8 0 0 0-.8-.8z",
  facebook: "M14 8h2.5l.5-3H14V3.8C14 2.6 14.4 2 15.7 2H17V-.9 2h-2.3C12 2 11 3.6 11 5.7V8H8.5v3H11v10h3V11h2.3l.4-3H14V8z",
  google: "M12 11v3h4.4a4.6 4.6 0 1 1-1.1-4.7l2.2-2.2A7.7 7.7 0 1 0 19.7 12c0-.3 0-.7-.1-1z",
  googleAds: "M4.5 18.5 11 7l3.5 6-4.9 8.6A2.9 2.9 0 0 1 4.5 18.5zm15 0a2.9 2.9 0 0 1-5 2.9L9.6 12.9 13 7l6.5 11.5zM7 3.9A2.9 2.9 0 0 1 11 7L4.5 18.5A2.9 2.9 0 0 1 7 3.9z",
  sms: "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1zm4 6.5h.01M12 10.5h.01M16 10.5h.01",
  cart: "M4 5h2l2 11h10l2-8H7M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H4",
  tag: "M3 12l9-9h7a1 1 0 0 1 1 1v7l-9 9a1 1 0 0 1-1.4 0L3 13.4A1 1 0 0 1 3 12zm13.5-5.5h.01",
  bolt: "M13 3 5 13h6l-1 8 8-10h-6l1-8z",
};

/** Ring config: [radiusPx, durationSec, direction, icon keys] */
const RINGS: [number, number, 1 | -1, (keyof typeof P)[]][] = [
  [430, 90, 1, ["mail", "whatsapp", "instagram", "google", "sms", "chart", "facebook", "tag"]],
  [300, 65, -1, ["telegram", "googleAds", "cart", "mail", "bolt", "instagram"]],
  [180, 45, 1, ["google", "whatsapp", "chart", "sms"]],
];

const TINTS = ["#3478f6", "#52514e", "#7c8cf8", "#1d4ed8", "#898781"];

export function TornadoBg() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes sl-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sl-orbit-r { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @media (prefers-reduced-motion: reduce) { .sl-ring { animation: none !important; } }
      `}</style>
      {/* The funnel: rings stacked with a squashed perspective, narrowing downward */}
      {RINGS.map(([radius, duration, dir, icons], ri) => (
        <div
          key={ri}
          className="absolute left-1/2"
          style={{
            top: `${[8, 46, 78][ri]}%`,
            transform: "translateX(-50%)",
            marginTop: `-${[430, 300, 180][ri]}px`,
          }}
        >
          <div
            className="sl-ring relative"
            style={{
              width: radius * 2,
              height: radius * 2,
              animation: `${dir === 1 ? "sl-orbit" : "sl-orbit-r"} ${duration}s linear infinite`,
            }}
          >
            {icons.map((key, i) => {
              const angle = (360 / icons.length) * i;
              return (
                <span
                  key={`${key}${i}`}
                  className="absolute left-1/2 top-1/2"
                  style={{ transform: `rotate(${angle}deg) translateX(${radius}px)` }}
                >
                  {/* Un-squash and counter-spin so glyphs stay upright */}
                  <span
                    className="block"
                    style={{
                      transform: `rotate(${-angle}deg)`,
                      animation: `${dir === 1 ? "sl-orbit-r" : "sl-orbit"} ${duration}s linear infinite`,
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width={ri === 0 ? 36 : ri === 1 ? 30 : 24}
                      height={ri === 0 ? 36 : ri === 1 ? 30 : 24}
                      fill="none"
                      stroke={TINTS[(ri + i) % TINTS.length]}
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: 0.32 - ri * 0.04 }}
                    >
                      <path d={P[key]} />
                    </svg>
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
