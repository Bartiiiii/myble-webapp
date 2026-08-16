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
import { sortedByHeat, type CategoryId, type LibraryItem } from "../../lib/library";
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

function LibraryCard({
  item,
  index,
  onDetails,
}: {
  item: LibraryItem;
  index: number;
  onDetails: (item: LibraryItem) => void;
}) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const narrow = useIsNarrow();
  const name = t(`library.items.${item.id}.n`);

  return (
    <Reveal delay={(index % 3) * 90}>
      {/* The 🔥 control is a SIBLING overlay, not a child of the card button —
          nesting one button inside another is invalid HTML and breaks
          hydration. It sits above the card via z-index instead. */}
      <div className="relative">
        <div className="card-lift group relative overflow-hidden rounded-2xl bg-white text-left ring-1 ring-zinc-200 sm:rounded-3xl">
          <div className="relative aspect-square overflow-hidden bg-[#ece7df]">
            <LazyStage item={item} reduced={reduced} />
          </div>
          <div className="p-3 sm:p-6">
            <div className="flex items-baseline justify-between gap-2 sm:gap-3">
              <h2 className="truncate text-sm font-semibold text-zinc-900 sm:text-lg">{name}</h2>
              <span className="hidden shrink-0 font-mono text-[11px] text-zinc-400 sm:inline">
                {t(`library.categories.${item.category}`)}
              </span>
            </div>
            <OpenInConfigurator
              item={item}
              className="press relative z-20 mt-1.5 inline-block text-[11px] font-semibold text-indigo-600 transition-colors hover:text-indigo-500 sm:mt-3 sm:text-xs"
            />
          </div>
          {/* Everything except the two real controls opens the detail dialog.
              A full-bleed sibling button (rather than wrapping the card) keeps
              the buttons un-nested and the .card-lift hover intact. */}
          <button
            type="button"
            onClick={() => onDetails(item)}
            aria-label={`${name}, ${t("library.details")}`}
            className="absolute inset-0 z-10 rounded-2xl sm:rounded-3xl"
          />
        </div>
        <div className="absolute left-2 top-2 z-20 sm:left-4 sm:top-4">
          <FireButton id={item.id} size={narrow ? "sm" : "md"} />
        </div>
      </div>
    </Reveal>
  );
}

/** Loads a design into the configurator's storage and goes there. Used on the
 *  card and again inside the detail dialog. */
function OpenInConfigurator({
  item,
  className,
  from = "card",
}: {
  item: LibraryItem;
  className: string;
  from?: "card" | "dialog";
}) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        posthog.capture("library_design_opened", { id: item.id, from });
        saveDesign(item.design);
        router.push("/design");
      }}
    >
      {t("library.open")}
    </button>
  );
}

/**
 * Detail dialog for one design: the piece up close, its story, who built it,
 * and the way into the configurator.
 *
 * Rendered by LibraryBody, not by the card — a card sits inside <Reveal>,
 * whose transform would make `position: fixed` resolve against the card
 * instead of the viewport.
 */
function DesignDialog({ item, onClose }: { item: LibraryItem | null; onClose: () => void }) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [item, onClose]);

  if (!item) return null;

  const name = t(`library.items.${item.id}.n`);
  const { w, h, d } = item.design.outerCm;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/45 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl ring-1 ring-zinc-200 sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("library.close")}
          className="press absolute right-3 top-3 z-10 rounded-full bg-white/92 p-1.5 text-zinc-500 ring-1 ring-zinc-900/10 backdrop-blur transition hover:text-zinc-900 sm:right-4 sm:top-4"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="grid sm:grid-cols-2">
          <div className="relative flex items-center justify-center bg-[#ece7df]">
            <ShelfViewer
              design={item.design}
              background={WALL}
              height={320}
              interactive
              autoRotate={!reduced}
              fit={1.0}
            />
            <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
              <FireButton id={item.id} />
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">
              {t(`library.categories.${item.category}`)}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-zinc-900">{name}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{t(`library.items.${item.id}.d`)}</p>

            <dl className="mt-6 space-y-2.5 border-t border-zinc-100 pt-5 text-sm">
              <SpecRow label={t("library.dimensions")}>
                <span className="font-mono">
                  {Math.round(w)} × {Math.round(h)} × {Math.round(d)} cm
                </span>
              </SpecRow>
              <SpecRow label={t("design.material")}>
                {t(`colors.${item.design.colour}`)} · <span className="font-mono">{item.design.thickness} mm</span>
              </SpecRow>
              <SpecRow label={t("library.boards")}>
                <span className="font-mono">{item.design.parts.length}</span>
              </SpecRow>
              <SpecRow label={t("library.byLabel")}>{t("library.by")}</SpecRow>
            </dl>

            <OpenInConfigurator
              item={item}
              from="dialog"
              className="press mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 sm:w-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-900">{children}</dd>
    </div>
  );
}

function LibraryBody() {
  const { t } = useI18n();
  const { counts } = useReactions();
  const [category, setCategory] = useState<CategoryId>("all");
  const [detail, setDetail] = useState<LibraryItem | null>(null);

  // Hottest first; ties fall back to the curated order, so the grid is stable
  // before anyone has reacted.
  const items = useMemo(() => sortedByHeat(counts, category), [counts, category]);

  return (
    <>
      {/* Intro */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-4 pt-12 sm:pt-16">
        <Reveal>
          <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-5xl">
            {t("library.title")}
          </h1>
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
            <LibraryCard key={item.id} item={item} index={i} onDetails={setDetail} />
          ))}
        </div>
      </section>

      <DesignDialog item={detail} onClose={() => setDetail(null)} />
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
