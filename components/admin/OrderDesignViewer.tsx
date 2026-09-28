"use client";

// The customer's 3D design, rendered next to the meble.pl production files so
// whoever is fulfilling the order can see the piece without leaving the page.
// Mirrors the /library popup pattern (Esc + backdrop close, body-scroll lock,
// prefers-reduced-motion guard) — just without the site's i18n context, which
// backstage doesn't provide, so this wraps its own LocaleProvider: ShelfViewer
// calls useT() unconditionally (for the editable role labels), even read-only.

import dynamic from "next/dynamic";
import React from "react";
import type { Design } from "@/lib/model";
import { LocaleProvider } from "@/lib/i18n";

const ShelfViewer = dynamic(() => import("@/components/ShelfViewer"), { ssr: false });

const WALL = "#ece7df"; // same warm niche stage tone used on /library and /order

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
     
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

function DimBadge({ design }: { design: Design }) {
  const { w, h, d } = design.outerCm;
  return (
    <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/92 px-2 py-1 font-mono text-[11px] font-medium text-zinc-800 ring-1 ring-zinc-900/10 backdrop-blur">
      {Math.round(w)} × {Math.round(h)} × {Math.round(d)} cm · {design.colour} {design.thickness} mm
    </span>
  );
}

function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Expand 3D preview"
      title="Expand"
      className="absolute right-3 top-3 z-10 rounded-lg bg-white/92 p-1.5 text-zinc-600 ring-1 ring-zinc-900/10 backdrop-blur transition hover:text-indigo-600"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
      </svg>
    </button>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="absolute right-3 top-3 z-10 rounded-full bg-white/92 p-1.5 text-zinc-500 ring-1 ring-zinc-900/10 backdrop-blur transition hover:text-zinc-900"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

/** Popup: same design, bigger canvas, its own Esc/backdrop close + scroll lock. */
function ExpandedViewer({ design, orderNo, reduced, onClose }: { design: Design; orderNo: string; reduced: boolean; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 sm:p-8"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${orderNo} — 3D design preview`}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-[#ece7df] shadow-2xl ring-1 ring-zinc-900/10"
      >
        <CloseButton onClick={onClose} />
        <DimBadge design={design} />
        <LocaleProvider>
          <ShelfViewer design={design} background={WALL} height={620} interactive autoRotate={!reduced} fit={1.05} />
        </LocaleProvider>
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-white/80 px-2 py-0.5 text-[11px] text-zinc-500 backdrop-blur">
          {orderNo} · drag to rotate
        </p>
      </div>
    </div>
  );
}

export function OrderDesignViewer({ design, orderNo }: { design: Design; orderNo: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const reduced = usePrefersReducedMotion();

  return (
    <>
      {/* Fills whatever height the row ends up being, with a floor so the piece
          is still readable when the panel beside it is fully collapsed. */}
      <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-xl bg-[#ece7df]">
        {expanded ? (
          // Only one WebGL context at a time: the popup owns the canvas while
          // it's open, this box just holds its place and says where it went.
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">3D preview opened</div>
        ) : (
          <>
            <ShelfViewer design={design} background={WALL} height="100%" interactive autoRotate={!reduced} fit={1.05} />
            <ExpandButton onClick={() => setExpanded(true)} />
            <p className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-zinc-500 backdrop-blur">
              drag to rotate
            </p>
          </>
        )}
        <DimBadge design={design} />
      </div>

      {expanded ? (
        <ExpandedViewer design={design} orderNo={orderNo} reduced={reduced} onClose={() => setExpanded(false)} />
      ) : null}
    </>
  );
}
