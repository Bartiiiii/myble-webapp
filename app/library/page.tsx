"use client";

// Design library — curated (and later community) pieces from the configurator.
// Every card is a real, orderable Design: clicking it writes the design to the
// configurator's storage and opens /design, so inspiration is one click from
// editing. Backstage approval for user submissions plugs into this page later.

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { Reveal } from "../../components/Reveal";
import { CategoryPills } from "../../components/CategoryPills";
import { FireButton } from "../../components/FireButton";
import { LIBRARY, sortedByHeat, type CategoryId, type LibraryItem } from "../../lib/library";
import { ReactionsProvider, useReactions } from "../../lib/reactions";
import { useIsNarrow } from "../../lib/useIsNarrow";
import { saveDesign } from "../../lib/design";
import { useI18n } from "../../lib/i18n";
import posthog from "posthog-js";

const ShelfViewer = dynamic(() => import("../../components/ShelfViewer"), { ssr: false });

const WALL = "#ece7df"; // the warm niche stage tone (brand material world)

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

/** Mono dimension chip — the brand signature (see brand-guidelines §4).
 *  Shrinks on phones so it can't collide with the 🔥 button opposite it on a
 *  half-width card. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none rounded-md bg-white/92 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-tight text-zinc-800 ring-1 ring-zinc-900/10 backdrop-blur sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-xs">
      {children}
    </span>
  );
}

/**
 * Mounts the WebGL viewer only while the card is near the viewport, so a page
 * of spinning models never holds more than a handful of GL contexts at once.
 */
function LazyStage({ item, reduced }: { item: LibraryItem; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const narrow = useIsNarrow();

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      {visible && (
        <ShelfViewer
          design={item.design}
          background={WALL}
          height={380}
          interactive={false}
          autoRotate={!reduced}
          lite
          fit={narrow ? 0.78 : 1.1}
        />
      )}
    </div>
  );
}

function LibraryCard({ item, index }: { item: LibraryItem; index: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const narrow = useIsNarrow();
  const { w, h, d } = item.design.outerCm;

  const open = () => {
    posthog.capture("library_design_opened", { id: item.id });
    saveDesign(item.design);
    router.push("/design");
  };

  return (
    <Reveal delay={(index % 3) * 90}>
      {/* The 🔥 control is a SIBLING overlay, not a child of the card button —
          nesting one button inside another is invalid HTML and breaks
          hydration. It sits above the card via z-index instead. */}
      <div className="relative">
      <button
        type="button"
        onClick={open}
        className="card-lift group block w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-zinc-200 sm:rounded-3xl"
        aria-label={`${t(`library.items.${item.id}.n`)}, ${t("library.open")}`}
      >
        <div className="relative aspect-square overflow-hidden bg-[#ece7df]">
          <LazyStage item={item} reduced={reduced} />
          <div className="absolute left-2 top-2 sm:left-4 sm:top-4">
            <Chip>
              {Math.round(w)} × {Math.round(h)} × {Math.round(d)}
              <span className="hidden sm:inline"> cm</span>
            </Chip>
          </div>
        </div>
        <div className="p-3 sm:p-6">
          <div className="flex items-baseline justify-between gap-2 sm:gap-3">
            <h2 className="truncate text-sm font-semibold text-zinc-900 sm:text-lg">{t(`library.items.${item.id}.n`)}</h2>
            <span className="hidden shrink-0 font-mono text-[11px] text-zinc-400 sm:inline">
              {t(`library.categories.${item.category}`)}
            </span>
          </div>
          {/* The blurb needs room to read; on a half-width card it just makes
              the tile tall, so the name + dimensions carry it there. */}
          <p className="mt-1.5 hidden text-sm leading-6 text-zinc-600 sm:block">{t(`library.items.${item.id}.d`)}</p>
          <p className="mt-1.5 text-xs font-semibold text-indigo-600 transition-colors group-hover:text-indigo-500 sm:mt-4 sm:text-sm">
            {t("library.open")}
          </p>
        </div>
      </button>
        <div className="absolute right-2 top-2 z-10 sm:right-4 sm:top-4">
          <FireButton id={item.id} size={narrow ? "sm" : "md"} />
        </div>
      </div>
    </Reveal>
  );
}

function LibraryBody() {
  const { t } = useI18n();
  const { counts } = useReactions();
  const [category, setCategory] = useState<CategoryId>("all");

  // Hottest first; ties fall back to the curated order, so the grid is stable
  // before anyone has reacted.
  const items = useMemo(() => sortedByHeat(counts, category), [counts, category]);

  return (
    <>
      {/* Intro */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-4 pt-12 sm:pt-16">
        <Reveal>
          <div className="flex items-baseline gap-4">
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-5xl">
              {t("library.title")}
            </h1>
            <span className="font-mono text-sm font-medium text-zinc-400">{LIBRARY.length}</span>
          </div>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-zinc-600">{t("library.intro")}</p>
        </Reveal>
      </section>

      {/* Category filter */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-4">
        <Reveal>
          <CategoryPills active={category} onSelect={setCategory} />
        </Reveal>
      </section>

      {/* Grid */}
      <section className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {items.map((item, i) => (
            <LibraryCard key={item.id} item={item} index={i} />
          ))}
        </div>
      </section>
    </>
  );
}

export default function LibraryPage() {
  const { t } = useI18n();

  return (
    <ReactionsProvider>
    <div className="min-h-screen bg-white text-zinc-900">
      <SiteHeader />

      <LibraryBody />

      {/* Share band */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24 pt-6">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-zinc-900 p-8 text-white sm:flex-row sm:items-center md:p-10">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("library.shareTitle")}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">{t("library.shareBody")}</p>
            </div>
            <Link
              href="/design"
              onClick={() => posthog.capture("home_cta_clicked", { location: "library" })}
              className="press inline-flex shrink-0 items-center justify-center rounded-xl bg-indigo-500 px-6 py-3.5 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              {t("home.heroCta")}
            </Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
    </ReactionsProvider>
  );
}
