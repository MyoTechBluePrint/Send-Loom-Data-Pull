"use client";

// Subtle scroll-into-view reveal, iOS-calm: small translate, gentle fade,
// once only. IntersectionObserver + CSS transition; no animation library.

import { useEffect, useRef } from "react";

export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    // Insurance: whatever happens with observation (hidden panes, reduced
    // motion, odd embeds), content must never stay invisible.
    const failsafe = setTimeout(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
      io.disconnect();
    }, 2500);
    return () => { io.disconnect(); clearTimeout(failsafe); };
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: "translateY(16px)",
        transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
