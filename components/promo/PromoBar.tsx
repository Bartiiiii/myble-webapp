"use client";

import React, { useState } from "react";
import posthog from "posthog-js";
import Link from "../../lib/localeNav";
import { usePromoCopy } from "./usePromoCopy";

// The scrolling offers strip above the site header. Two identical tracks slide
// left in step, so the loop has no seam; the second is aria-hidden and out of
// the tab order, so screen readers and keyboards meet each offer once.
//
// Moving content that runs longer than 5 s needs a way to stop it (WCAG 2.2.2):
// hovering or focusing the strip pauses it, the button pauses it for good, and
// prefers-reduced-motion turns it into a still, swipeable row (globals.css).

type Item = { key: string; href: string; label: string; icon: React.ReactNode };

export function PromoBar() {
  const c = usePromoCopy();
  const [paused, setPaused] = useState(false);

  const items: Item[] = [
    { key: "delivery", href: "/delivery", label: c.bar.delivery, icon: <TruckIcon /> },
    { key: "refer", href: "/refer", label: c.bar.refer, icon: <GiftIcon /> },
    { key: "plus", href: "/myble-plus", label: c.bar.plus, icon: <PlusIcon /> },
    { key: "library", href: "/library", label: c.bar.library, icon: <GridIcon /> },
  ];
  // Two rounds per track keeps one track wider than any screen, so the strip
  // never shows a gap before the second track slides in.
  const round = [...items, ...items];

  return (
    <div className="relative z-50 bg-zinc-950 text-zinc-300" role="region" aria-label={c.bar.label}>
      <div className="promo-marquee flex h-14 overflow-hidden pr-12" data-paused={paused}>
        {[0, 1].map((copy) => (
          <ul key={copy} className="promo-track flex shrink-0 items-center" aria-hidden={copy === 1 || undefined}>
            {round.map((it, i) => (
              <li key={`${it.key}-${i}`} className="shrink-0">
                <Link
                  href={it.href}
                  tabIndex={copy === 1 || i >= items.length ? -1 : undefined}
                  onClick={() => posthog.capture("promo_bar_clicked", { offer: it.key })}
                  className="group flex items-center gap-2.5 px-7 font-mono text-[11.5px] uppercase leading-none tracking-[0.06em] transition hover:text-white focus-visible:text-white focus-visible:outline-none"
                >
                  <span className="text-indigo-300 transition group-hover:text-indigo-200">{it.icon}</span>
                  <BrandCase text={it.label} />
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? c.bar.play : c.bar.pause}
        aria-pressed={paused}
        className="promo-toggle absolute right-0 top-0 flex h-14 w-12 items-center justify-center bg-zinc-950 text-zinc-400 transition hover:text-white"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-zinc-700">
          {paused ? (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
              <path d="M3 1.8v8.4L10 6z" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
              <rect x="2.5" y="2" width="2.4" height="8" rx="0.6" />
              <rect x="7.1" y="2" width="2.4" height="8" rx="0.6" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}

/** The strip is set in capitals, but the wordmark is always lowercase and the
 *  currency keeps its own spelling ("Kč", never "KČ"). */
function BrandCase({ text }: { text: string }) {
  const parts = text.split(/(myble\+?|Kč)/);
  return (
    <span className="whitespace-nowrap">
      {parts.map((p, i) =>
        /^myble\+?$/.test(p) ? (
          <span key={i} className="font-sans text-[13px] font-semibold normal-case tracking-[-0.02em] text-white">
            {p}
          </span>
        ) : p === "Kč" ? (
          <span key={i} className="normal-case">
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </span>
  );
}

// Line icons drawn for the strip: 16 px grid, 1.5 stroke, round caps.
const iconProps = {
  viewBox: "0 0 16 16",
  className: "h-4 w-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function TruckIcon() {
  return (
    <svg {...iconProps}>
      <path d="M1.5 4h8v6.5h-8z" />
      <path d="M9.5 6.5h3l2 2.2v1.8h-5" />
      <circle cx="4.25" cy="11.75" r="1.25" />
      <circle cx="11.75" cy="11.75" r="1.25" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 6h12v2.5H2zM3 8.5h10V14H3zM8 6v8" />
      <path d="M8 6C6.5 6 4.8 5.4 4.8 4.1 4.8 3 6 2.6 6.8 3.3 7.5 3.9 8 6 8 6zM8 6c1.5 0 3.2-.6 3.2-1.9C11.2 3 10 2.6 9.2 3.3 8.5 3.9 8 6 8 6z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...iconProps}>
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="3.5" />
      <path d="M8 5v6M5 8h6" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg {...iconProps}>
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2" />
      <path d="M9.5 1.75v12.5M1.75 9.5H9.5M9.5 6h4.75" />
    </svg>
  );
}
