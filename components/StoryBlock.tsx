"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Reveal } from "./Reveal";

// Every story photo is the same portrait crop straight out of the optimiser.
const PHOTO_W = 787;
const PHOTO_H = 1400;
// Peak parallax travel, in px, at either end of the block's time on screen.
const PARALLAX_PX = 20;

/** Mono dimension chip — the brand signature: measurements dress like product.
 *  Same vocabulary as the homepage hero (app/page.tsx). */
export function DimChip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`pointer-events-none rounded-lg bg-white/92 px-2.5 py-1 font-mono text-xs font-medium tracking-tight text-zinc-800 ring-1 ring-zinc-900/10 backdrop-blur ${className}`}
    >
      {children}
    </span>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

export type OffsetCard = {
  src: string;
  alt: string;
  /** Width, absolute placement and rotation on `lg`; the card collapses into a flat 2-up row below that. */
  pos: string;
};

export type StoryBlockProps = {
  n: string;
  heading: string;
  /** First paragraph reads as the lead-in and gets the darker, heavier treatment. */
  paras: readonly string[];
  caption: string;
  src: string;
  alt: string;
  /** Which side the photo sits on at `lg`. The offset cards hang off the outer edge. */
  side: "left" | "right";
  chips?: readonly string[];
  offsets?: readonly OffsetCard[];
  priority?: boolean;
  children?: React.ReactNode;
};

export function StoryBlock({
  n,
  heading,
  paras,
  caption,
  src,
  alt,
  side,
  chips = [],
  offsets = [],
  priority = false,
  children,
}: StoryBlockProps) {
  const reduced = usePrefersReducedMotion();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Slow vertical parallax: transform-only, rAF-throttled, single scroll
  // listener per block. The photo is oversized by 6% so the travel never
  // exposes an edge. Fully skipped under prefers-reduced-motion.
  useEffect(() => {
    if (reduced) return;
    const img = imgRef.current;
    if (img) img.style.willChange = "transform";
    let raf = 0;
    const apply = () => {
      raf = 0;
      const frame = frameRef.current;
      const el = imgRef.current;
      if (!frame || !el) return;
      const r = frame.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      // 0 as the block enters from the bottom, 1 as it leaves past the top.
      const raw = (vh - r.top) / (vh + r.height);
      const p = Math.min(1, Math.max(0, raw));
      el.style.transform = `translate3d(0, ${((p - 0.5) * -2 * PARALLAX_PX).toFixed(2)}px, 0) scale(1.06)`;
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
      if (img) {
        img.style.willChange = "";
        img.style.transform = "";
      }
    };
  }, [reduced]);

  const mediaCol = side === "right" ? "lg:col-start-8 lg:col-span-5 lg:pr-12" : "lg:col-start-1 lg:col-span-5 lg:pl-12";
  const textCol = side === "right" ? "lg:col-start-1 lg:col-span-6 lg:row-start-1" : "lg:col-start-7 lg:col-span-6 lg:row-start-1";

  return (
    <section
      data-story-block={n}
      id={`story-${n}`}
      className="scroll-mt-28 py-16 first:pt-0 sm:py-20 lg:py-28"
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-x-0 lg:gap-y-0">
        {/* Media first in the DOM so mobile stacks photo → text. */}
        <div className={mediaCol}>
          {/* A full-bleed portrait photo is overwhelming on a tablet, so the
              stacked layout caps it; at lg the grid column sets the width. */}
          <Reveal className="mx-auto w-full max-w-[26rem] lg:max-w-none">
            <div ref={frameRef} className="relative">
              <div className="relative overflow-hidden rounded-3xl bg-zinc-100 ring-1 ring-zinc-900/10 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]">
                <Image
                  ref={imgRef}
                  src={src}
                  alt={alt}
                  width={PHOTO_W}
                  height={PHOTO_H}
                  priority={priority}
                  loading={priority ? undefined : "lazy"}
                  sizes="(min-width: 1024px) 34vw, (min-width: 640px) 60vw, 92vw"
                  className="h-auto w-full scale-[1.06] object-cover"
                />
              </div>

              {chips.length > 0 && (
                <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-2">
                  {chips.map((c) => (
                    <DimChip key={c} className="story-chip">
                      {c}
                    </DimChip>
                  ))}
                </div>
              )}

              {/* Prints dropped on a desk. Desktop only — below lg they become a flat row. */}
              {offsets.map((o) => (
                <div key={o.src} className={`story-print absolute hidden lg:block ${o.pos}`}>
                  <Image
                    src={o.src}
                    alt={o.alt}
                    width={PHOTO_W}
                    height={PHOTO_H}
                    loading="lazy"
                    sizes="14vw"
                    className="h-auto w-full rounded-2xl border-[6px] border-white object-cover shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)]"
                  />
                </div>
              ))}
            </div>

            {offsets.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 lg:hidden">
                {offsets.map((o) => (
                  <Image
                    key={o.src}
                    src={o.src}
                    alt={o.alt}
                    width={PHOTO_W}
                    height={PHOTO_H}
                    loading="lazy"
                    sizes="45vw"
                    className="h-auto w-full rounded-2xl object-cover ring-1 ring-zinc-900/10"
                  />
                ))}
              </div>
            )}

            {/* The offset cards hang below the photo on lg, so the caption
                steps out of their way there. */}
            <p
              className={`mt-4 flex items-start gap-2 font-mono text-[11px] leading-5 text-zinc-400 ${
                offsets.length > 0 ? "lg:mt-20" : ""
              }`}
            >
              <span aria-hidden className="mt-2 block h-px w-3 shrink-0 bg-zinc-300" />
              {caption}
            </p>
          </Reveal>
        </div>

        <div className={`${textCol} mt-2 lg:mt-0`}>
          <Reveal delay={80}>
            <div className="border-t-2 border-zinc-900 pt-6">
              <span className="font-mono text-sm font-medium text-zinc-400">{n}</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-zinc-900 sm:text-3xl">{heading}</h2>
              {paras.map((p, i) => (
                <p
                  key={p.slice(0, 24)}
                  className={
                    i === 0
                      ? "mt-5 text-base leading-7 font-medium text-zinc-900"
                      : "mt-4 text-base leading-7 text-zinc-600"
                  }
                >
                  {p}
                </p>
              ))}
              {children}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
