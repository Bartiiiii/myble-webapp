"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * The story section's index, drawn as a vertical measuring tape: a hairline
 * with ticks every 8px, an indigo segment that fills with scroll progress, and
 * a mono numeral per block. It turns the brand's "measurements as product"
 * idea into the page's navigation.
 *
 * Desktop only (hidden below lg). Progress comes from one rAF-throttled scroll
 * listener; the active block comes from a single IntersectionObserver over the
 * [data-story-block] anchors. Neither is decorative motion, so both stay on
 * under prefers-reduced-motion — but the fill has no transition, so nothing
 * animates on its own.
 */
export function StoryRail({
  numbers,
  containerRef,
}: {
  numbers: readonly string[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const fillRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let raf = 0;
    const apply = () => {
      raf = 0;
      const el = containerRef.current;
      const fill = fillRef.current;
      if (!el || !fill) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      // Progress of the viewport's middle through the story section.
      const p = (vh / 2 - r.top) / Math.max(1, r.height);
      fill.style.height = `${(Math.min(1, Math.max(0, p)) * 100).toFixed(2)}%`;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const blocks = Array.from(el.querySelectorAll<HTMLElement>("[data-story-block]"));
    if (blocks.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = blocks.indexOf(entry.target as HTMLElement);
          if (i >= 0) setActive(i);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    for (const b of blocks) io.observe(b);
    return () => io.disconnect();
  }, [containerRef]);

  const last = Math.max(1, numbers.length - 1);

  return (
    <div aria-hidden className="hidden lg:block">
      <div className="sticky top-28">
        <div className="relative h-[62vh] w-14">
          {/* Tick marks every 8px */}
          <div
            className="absolute left-0 top-0 h-full w-2"
            style={{
              backgroundImage: "repeating-linear-gradient(to bottom, #d4d4d8 0 1px, transparent 1px 8px)",
            }}
          />
          {/* The tape itself, and the indigo segment filled by scroll progress */}
          <div className="absolute left-0 top-0 h-full w-px bg-zinc-300" />
          <div ref={fillRef} className="absolute left-0 top-0 w-px bg-indigo-600" style={{ height: "0%" }} />

          {numbers.map((n, i) => (
            <div
              key={n}
              className="absolute left-0 flex -translate-y-1/2 items-center gap-2"
              style={{ top: `${(i / last) * 100}%` }}
            >
              <span className={`block h-px w-5 ${i === active ? "bg-zinc-900" : "bg-zinc-400"}`} />
              <span
                className={`font-mono text-xs ${i === active ? "font-semibold text-zinc-900" : "text-zinc-400"}`}
              >
                {n}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
