"use client";

// Loomi, the SendLoom mascot, standing at the subscription card.
//
// Static by design (Steve's call): no peek-a-boo cycles, no timers. The
// waving pose from the approved character sheet sits tucked behind the
// card's left edge with his hand gripping the card face, exactly like the
// approved landing mock. He rides the card wrapper's float so the grip
// never drifts. On mobile he's the happy bust looking over the card's
// top corner instead, where a side peek would fall off-screen.
//
// Layering: body renders under the card (z-1 vs the card's z-2), the grip
// hand renders over the card face (z-3). Geometry comes from the character
// sheet panels, scaled by the real card height.

import { useEffect, useRef, useState } from "react";

const BODY = { src: "/mascot/wave-body.png", w: 131, h: 212, top: 17, cardH: 256 };
const GRIP = { src: "/mascot/hand-fingers.png", w: 16, h: 117, top: 5, left: -4, cardH: 237 };
const BUST = { src: "/mascot/peek-top.png", w: 174, h: 229 };

const SCALE = 0.62;     // size relative to the sheet's proportion
const TOP_BIAS = 0.28;  // sits below the headline, clear of "effortless."

export function Loomi() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const el = wrapRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.clientHeight));
    ro.observe(el);
    setCardH(el.clientHeight);
    const mm = window.matchMedia("(max-width: 1023px)");
    const setM = () => setMobile(mm.matches);
    setM();
    mm.addEventListener("change", setM);
    return () => { ro.disconnect(); mm.removeEventListener("change", setM); };
  }, []);

  if (mobile === null || !cardH) {
    return <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0" />;
  }

  // Mobile: the bust looks over the card's top-right corner.
  if (mobile) {
    const bustH = Math.min(150, cardH * 0.3);
    const bustW = bustH * (BUST.w / BUST.h);
    return (
      <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
        <img
          src={BUST.src} alt="" loading="lazy" decoding="async"
          width={BUST.w} height={BUST.h}
          className="absolute -rotate-[4deg]"
          style={{ right: "7%", top: -bustH * 0.55, width: bustW, height: "auto" }}
        />
      </div>
    );
  }

  const bodyW = BODY.w * ((cardH * SCALE) / BODY.cardH);
  const bodyTop = BODY.top * ((cardH * SCALE) / BODY.cardH);
  const gripS = (cardH * SCALE) / GRIP.cardH;

  return (
    <>
      {/* body: under the card, tucked against its left edge */}
      <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
        <div className="absolute" style={{ right: "calc(100% - 10px)", top: cardH * TOP_BIAS, width: bodyW, height: cardH }}>
          <img
            src={BODY.src} alt="" loading="lazy" decoding="async"
            width={BODY.w} height={BODY.h}
            className="absolute"
            style={{ right: 0, top: bodyTop, width: bodyW, height: "auto" }}
          />
          {/* soft contact shadow so he sits in the scene */}
          <div
            className="absolute"
            style={{
              left: -bodyW * 0.15, right: bodyW * 0.2, top: cardH * 0.5, height: cardH * 0.28,
              background: "radial-gradient(closest-side, rgba(0,0,0,0.4), transparent 70%)",
              filter: "blur(10px)",
            }}
          />
        </div>
      </div>

      {/* grip hand: over the card face, holding the edge */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[3]">
        <img
          src={GRIP.src} alt="" loading="lazy" decoding="async"
          width={GRIP.w} height={GRIP.h}
          className="absolute"
          style={{ left: (GRIP.left ?? 0) * gripS, top: GRIP.top * gripS + cardH * TOP_BIAS, width: GRIP.w * gripS, height: "auto" }}
        />
      </div>
    </>
  );
}
