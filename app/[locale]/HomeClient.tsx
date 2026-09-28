"use client";

import Link from "../../lib/localeNav";
import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { NewsletterForm } from "../../components/NewsletterForm";
import { Reveal } from "../../components/Reveal";
import { CategoryPills } from "../../components/CategoryPills";
import { FireButton } from "../../components/FireButton";
import { type Design, type LegacyDesign, legacyToDesign } from "../../lib/design";
import { AuthorChip } from "../../components/library/AuthorChip";
import { DesignDialog } from "../../components/library/DesignDialog";
import { itemName, sortedByHeat, type CategoryId, type LibraryItem } from "../../lib/library";
import { ReactionsProvider, useReactions } from "../../lib/reactions";
import { useLibraryPool } from "../../lib/useLibraryPool";
import { useIsNarrow } from "../../lib/useIsNarrow";
import { useI18n, useT, tList, type Locale } from "../../lib/i18n";
import posthog from "posthog-js";
import { productsJsonLd } from "../../lib/structuredData";

function HeroLoading() {
  const t = useT();
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-50 text-sm text-zinc-400">
      {t("common.loadingShort")}
    </div>
  );
}

const ShelfViewer = dynamic(() => import("../../components/ShelfViewer"), {
  ssr: false,
  loading: () => <HeroLoading />,
});

/* ------------------------------------------- spinning 3D hero showcase */

const WALL = "#ece7df"; // warm niche back-wall tone the canvas blends into
const SHOWCASE_MS = 3200;
const OUT_MS = 380;
const IN_MS = 580;

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

const SHOWCASE_LEGACY: LegacyDesign[] = [
  {
    widthCm: 72, heightCm: 132, depthCm: 34, decor: "dub",
    planks: [
      { id: "cat-1", o: "h", x: 0, y: 28, len: 36 },
      { id: "cat-2", o: "h", x: 34, y: 52, len: 34 },
      { id: "cat-3", o: "h", x: 0, y: 78, len: 36 },
      { id: "cat-4", o: "h", x: 34, y: 102, len: 34 },
      { id: "cat-den", o: "v", x: 40, y: 0, len: 28 },
    ],
  },
  {
    widthCm: 100, heightCm: 58, depthCm: 42, decor: "grafit",
    planks: [
      { id: "vin-mid", o: "h", x: 0, y: 27, len: 96 },
      { id: "vin-1", o: "v", x: 30, y: 0, len: 25 },
      { id: "vin-2", o: "v", x: 50, y: 0, len: 25 },
      { id: "vin-3", o: "v", x: 70, y: 0, len: 25 },
    ],
  },
  {
    widthCm: 82, heightCm: 122, depthCm: 33, decor: "dub",
    planks: [
      { id: "cube-v", o: "v", x: 38, y: 0, len: 118 },
      { id: "cube-1", o: "h", x: 0, y: 23, len: 78 },
      { id: "cube-2", o: "h", x: 0, y: 47, len: 78 },
      { id: "cube-3", o: "h", x: 0, y: 71, len: 78 },
      { id: "cube-4", o: "h", x: 0, y: 95, len: 78 },
    ],
  },
  {
    widthCm: 130, heightCm: 44, depthCm: 40, decor: "bila",
    planks: [
      { id: "tv-v1", o: "v", x: 42, y: 0, len: 40 },
      { id: "tv-v2", o: "v", x: 84, y: 0, len: 40 },
      { id: "tv-hl", o: "h", x: 0, y: 20, len: 42 },
      { id: "tv-hr", o: "h", x: 86, y: 20, len: 40 },
    ],
  },
  {
    widthCm: 112, heightCm: 134, depthCm: 45, decor: "grafit",
    planks: [
      { id: "desk-top", o: "h", x: 0, y: 70, len: 108 },
      { id: "desk-vr", o: "v", x: 72, y: 70, len: 60 },
      { id: "desk-u1", o: "h", x: 74, y: 96, len: 34 },
      { id: "desk-u2", o: "h", x: 74, y: 116, len: 34 },
      { id: "desk-vl", o: "v", x: 36, y: 0, len: 70 },
      { id: "desk-l1", o: "h", x: 0, y: 34, len: 36 },
    ],
  },
];

const SHOWCASE: Design[] = SHOWCASE_LEGACY.map((l) => legacyToDesign(l));

/** Mono dimension chip — the brand signature: measurements dress like product. */
function DimChip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`pointer-events-none rounded-lg bg-white/92 px-2.5 py-1 font-mono text-xs font-medium tracking-tight text-zinc-800 ring-1 ring-zinc-900/10 backdrop-blur ${className}`}
    >
      {children}
    </span>
  );
}

function HeroShowcase() {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setOut(true);
      setTimeout(() => {
        setI((prev) => (prev + 1) % SHOWCASE.length);
        setOut(false);
      }, OUT_MS);
    }, SHOWCASE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const piece = SHOWCASE[i];

  return (
    <div>
      <div
        className="relative isolate h-96 overflow-hidden rounded-3xl bg-[#0b0d12] ring-1 ring-white/10 shadow-[inset_0_2px_44px_rgba(0,0,0,0.55)]"
        style={{ clipPath: "inset(0 round 1.5rem)" }}
      >

        {/* Soft radial highlight behind the model — grounds the piece on the dark stage. */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(60% 54% at 50% 43%, rgba(165,180,252,0.22), rgba(99,102,241,0.10) 30%, transparent 66%)",
          }}
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[9%] bg-gradient-to-r from-black/40 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[9%] bg-gradient-to-l from-black/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[8%] bg-gradient-to-b from-black/35 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[22%] bg-gradient-to-t from-black/35 to-transparent" />

        <div
          className="relative z-[1] h-full w-full"
          style={{
            opacity: out ? 0 : 1,
            transform: out ? "scale(0.88) translateY(10px)" : "scale(1) translateY(0)",
            filter: out ? "blur(8px)" : "blur(0px)",
            transition: out
              ? `opacity ${OUT_MS}ms ease-in, transform ${OUT_MS}ms ease-in, filter ${OUT_MS}ms ease-in`
              : `opacity ${IN_MS}ms cubic-bezier(0.16,1,0.3,1), transform ${IN_MS}ms cubic-bezier(0.16,1,0.3,1), filter ${IN_MS}ms ease-out`,
          }}
        >
          <ShelfViewer design={piece} background="transparent" height={384} interactive={false} autoRotate={!reduced} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- hero text reveal */

function HeroCopy() {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  // transitions-dev · 18 Texts reveal: play the staggered entrance on mount.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => el.classList.add("is-shown"));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} className="t-stagger">
      <h1 className="t-stagger-line t-stagger-line--1 text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-zinc-900 sm:text-6xl">
        {t("home.heroTitle")}
      </h1>
      <p className="t-stagger-line t-stagger-line--2 mt-2.5 max-w-xl text-[13px] leading-5 text-zinc-600 sm:mt-6 sm:text-lg sm:leading-7">
        {t("home.heroBody")}
      </p>
      <div className="t-stagger-line t-stagger-line--3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/design"
          onClick={() => posthog.capture("home_cta_clicked", { location: "hero" })}
          className="press inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          {t("home.heroCta")}
        </Link>
        <Link
          href="/library"
          onClick={() => posthog.capture("home_library_clicked", { location: "hero" })}
          className="inline-flex items-center justify-center px-1 py-3.5 text-sm font-semibold text-zinc-600 transition hover:text-zinc-900 sm:justify-start"
        >
          {t("home.heroLibrary")}
        </Link>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- icons (text comes from i18n) */

const STEP_ICONS = [
  <svg key="1" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20h16M6 16l9-9 3 3-9 9H6v-3z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg key="2" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg key="3" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 7l3 3M5 21l4-1 9.5-9.5a2.1 2.1 0 0 0-3-3L6 17l-1 4z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
];
const STEP_KEYS = ["design", "order", "assemble"] as const;

/* Step media — still frame that swaps to a looping GIF on hover/focus/tap.
   The GIF must load from a real network URL: WebKit refuses to animate GIFs
   served from blob: URLs and freezes them on frame one. */
function StepMedia({ index, alt }: { index: number; alt: string }) {
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [gifReady, setGifReady] = useState(false);
  const reduced = usePrefersReducedMotion();
  const still = `/steps/step-${index}.jpg`;
  const gif = `/steps/step-${index}.gif`;
  const lastTouchAt = useRef(0);

  /** Replay from frame one. Bumping the key swaps in a brand-new <img> node,
   *  and GIF animation state lives on the element, not the URL — so a fresh
   *  node always decodes from the first frame. This is the same thing a
   *  desktop hover-out → hover-in does, which is why tapping now matches it. */
  const restart = () => {
    if (reduced) return;
    setGifReady(false);
    setPlayKey((k) => k + 1);
    setPlaying(true);
  };

  const onTouch = () => {
    lastTouchAt.current = Date.now();
    restart();
  };
  // iOS fires a synthetic mouseenter right after a tap; without this guard the
  // clip would restart a second time and read as a flicker.
  const onEnter = () => {
    if (Date.now() - lastTouchAt.current < 800) return;
    restart();
  };
  const stop = () => {
    // After a tap there's no pointer to leave, and iOS emits a stray
    // mouseleave; keep playing so the clip runs its loop.
    if (Date.now() - lastTouchAt.current < 800) return;
    setPlaying(false);
    setGifReady(false);
  };

  return (
    <div
      className="group relative w-full overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200"
      style={{ aspectRatio: "3 / 2" }}
      onMouseEnter={onEnter}
      onMouseLeave={stop}
      onFocus={onEnter}
      onBlur={stop}
      onTouchStart={onTouch}
      tabIndex={0}
      role="img"
      aria-label={alt}
    >
      <img
        src={still}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
      {playing && (
        <img
          key={playKey}
          src={gif}
          alt=""
          aria-hidden="true"
          decoding="async"
          onLoad={() => setGifReady(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${gifReady ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
// "What you pay for": configurator · cut & drilled · packed · instructions.
const MATERIAL_ICONS = [
  "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z", // modular grid — build it your way
  "M3 9h18v6H3zM7 9v3M11 9v4M15 9v3",                    // ruler — cut to the millimetre
  "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",      // parcel — packed and shipped
  "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4",             // document — your own instructions
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 5" />
    </svg>
  );
}

/* -------------------------------------------------- FAQ — t-acc accordion */

function FaqList() {
  const { locale } = useI18n();
  const faq = (tList(locale, "home.faq") as { q: string; a: string }[]) ?? [];
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mx-auto w-full max-w-3xl divide-y divide-zinc-200 border-y border-zinc-200">
      {faq.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="t-acc" data-open={isOpen}>
            <button
              className="t-acc-head flex w-full items-center justify-between gap-6 px-1 py-5 text-left"
              onClick={() => {
                const opening = !isOpen;
                setOpen(opening ? i : null);
                if (opening) posthog.capture("faq_item_opened", { question: it.q });
              }}
              aria-expanded={isOpen}
            >
              <span className="text-base font-medium text-zinc-900">{it.q}</span>
              <span className="t-acc-chevron flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6.5L8 10.5L12 6.5" />
                </svg>
              </span>
            </button>
            <div className="t-acc-panel">
              <div className="t-acc-panel-inner">
                <p className="max-w-2xl px-1 pb-5 text-sm leading-6 text-zinc-600">{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------- design library highlights */

/**
 * Homepage highlights from the Design Library.
 *
 * A grid, not a carousel: the job of this section is to make the range of the
 * library obvious at a glance, and a carousel hides everything past the first
 * card or two. The category pills do most of that work — "Music & TV · Office ·
 * Pets" signals breadth faster than extra tiles would — and the grid then shows
 * the hottest six, so the section refreshes itself as people react.
 */
function LibraryHighlights() {
  const { t } = useI18n();
  const { counts } = useReactions();
  const { pool } = useLibraryPool();
  const [category, setCategory] = useState<CategoryId>("all");
  const [detail, setDetail] = useState<LibraryItem | null>(null);
  const reduced = usePrefersReducedMotion();

  const items = useMemo(() => sortedByHeat(counts, category, pool).slice(0, 6), [counts, category, pool]);

  return (
    <section id="nabidka" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 pb-24">
      <Reveal>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              {t("home.productsTitle")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-zinc-600">{t("home.productsBody")}</p>
          </div>
          <Link
            href="/library"
            onClick={() => posthog.capture("home_library_clicked", { location: "products" })}
            className="press mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            {t("home.heroLibrary")}
          </Link>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-8">
          <CategoryPills active={category} onSelect={setCategory} pool={pool} />
        </div>
      </Reveal>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {items.map((item, i) => (
          <Reveal key={item.id} delay={(i % 3) * 80}>
            <HighlightCard item={item} reduced={reduced} t={t} onDetails={setDetail} />
          </Reveal>
        ))}
      </div>

      {/* Rendered here, not inside a card: <Reveal> applies a transform, and a
          fixed-position dialog inside one would resolve against the card. */}
      <DesignDialog item={detail} onClose={() => setDetail(null)} from="home" />
    </section>
  );
}

function HighlightCard({
  item,
  reduced,
  t,
  onDetails,
}: {
  item: LibraryItem;
  reduced: boolean;
  t: ReturnType<typeof useI18n>["t"];
  onDetails: (item: LibraryItem) => void;
}) {
  const [visible, setVisible] = useState(false);
  const narrow = useIsNarrow();
  const name = itemName(item, t);

  // Only run the WebGL preview while the card is near the viewport, so six
  // spinning models never hold six live GL contexts at once. A ref callback
  // rather than an effect: the node arrives at commit time, so nothing reads
  // ref.current and nothing sets state from inside an effect.
  const observe = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true); // no observer support: just render it
      return;
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "250px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // The 🔥 control and the designer link are SIBLING overlays, not children of
    // the card's click target — nesting interactive content breaks hydration.
    <div className="relative">
      <div className="card-lift group relative overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200">
        <div ref={observe} className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#ece7df]">
          {visible && (
            <ShelfViewer
              design={item.design}
              background={WALL}
              height={260}
              interactive={false}
              autoRotate={!reduced}
              lite
              fit={narrow ? 0.78 : 1.1}
            />
          )}
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="truncate text-base font-semibold text-zinc-900">{name}</h3>
            <span className="shrink-0 font-mono text-[11px] text-zinc-400">
              {t(`library.categories.${item.category}`)}
            </span>
          </div>
          <div className="mt-2 flex items-center">
            <AuthorChip
              author={item.author}
              onNavigate={() => posthog.capture("designer_opened", { handle: item.author.handle, from: "home_card" })}
            />
          </div>
        </div>
        {/* Tapping the card opens the same detail dialog the library uses,
            rather than sending the visitor off to /library to find it again. */}
        <button
          type="button"
          onClick={() => {
            posthog.capture("home_highlight_clicked", { id: item.id });
            onDetails(item);
          }}
          aria-label={`${name}, ${t("library.details")}`}
          className="absolute inset-0 z-10 rounded-3xl"
        />
      </div>
      <div className="absolute left-3 top-3 z-20">
        <FireButton id={item.id} size="sm" />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- page */

export default function HomePage() {
  const { t, fmt, locale } = useI18n();
  const compareCols = [t("home.compare.ikea"), t("home.compare.myble"), t("home.compare.carpenter")];
  const compareRows = ([1, 2, 3, 4, 5] as const).map((n) => ({
    k: t(`home.compare.r${n}k`),
    v: (tList(locale as Locale, `home.compare.r${n}`) as string[]) ?? [],
  }));

  return (
    <ReactionsProvider>
    <div className="min-h-screen bg-white text-zinc-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productsJsonLd(locale)) }}
      />
      <SiteHeader />

      {/* Hero — split: staggered copy left, live configurator stage right */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-10 pt-12 sm:pt-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <HeroCopy />
          <Reveal delay={120}>
            <HeroShowcase />
          </Reveal>
        </div>
      </section>

      {/* Trust bar — quiet hairline strip */}
      <section className="border-y border-zinc-200 bg-zinc-50/60">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-4 text-sm text-zinc-600">
          <span className="inline-flex items-center gap-2"><CheckIcon /> {t("home.trustBar.fast")}</span>
          <span className="inline-flex items-center gap-2"><CheckIcon /> {t("home.trustBar.precise")}</span>
          <span className="inline-flex items-center gap-2"><CheckIcon /> {t("home.trustBar.shipping")}</span>
        </div>
      </section>

      {/* How it works — hairline step rail with mono numerals */}
      <section id="jak" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-24">
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            {t("home.stepsTitle")}
          </h2>
        </Reveal>
        <div className="mt-14 grid grid-cols-3 gap-3 sm:gap-6 md:gap-8">
          {STEP_KEYS.map((k, i) => (
            <Reveal key={k} delay={i * 90}>
              <div className="border-t-2 border-zinc-900 pt-6">
                <StepMedia index={i + 1} alt={t(`home.steps.${k}.t`)} />
                <div className="mt-5 flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-zinc-400">0{i + 1}</span>
                  <span className="text-zinc-400">{STEP_ICONS[i]}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-zinc-900 sm:text-lg">{t(`home.steps.${k}.t`)}</h3>
                {/* Mobile gets a 3-4 word gist; the full sentence needs the room
                    a wider column gives it. */}
                <p className="mt-1.5 text-[13px] leading-5 text-zinc-600 sm:hidden">{t(`home.steps.${k}.s`)}</p>
                <p className="mt-2 hidden text-sm leading-6 text-zinc-600 sm:block">{t(`home.steps.${k}.b`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Design library highlights — category pills + trending grid */}
      <LibraryHighlights />

      {/* Comparison — Myble column carries the accent */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{t("home.compareTitle")}</h2>
          <p className="mt-3 max-w-2xl text-base text-zinc-600">{t("home.compareBody")}</p>
        </Reveal>
        <Reveal delay={90}>
          {/* Same table at every width — just scaled down on mobile (tighter
              padding, smaller text, table-fixed so columns stay equal and the
              whole thing fits the viewport with no horizontal scroll). */}
          <div className="mt-10">
            <table className="w-full table-fixed border-separate border-spacing-0 text-[11px] sm:text-sm">
              <thead>
                <tr>
                  <th className="w-1/4 px-1.5 py-2 text-left font-medium text-zinc-500 sm:px-4 sm:py-3"></th>
                  {compareCols.map((c, ci) => {
                    const me = ci === 1;
                    return (
                      <th
                        key={c}
                        className={`px-1 py-2 text-center font-semibold sm:px-4 sm:py-3.5 sm:text-base ${
                          me ? "rounded-t-lg bg-indigo-600 text-white sm:rounded-t-2xl" : "text-zinc-500"
                        }`}
                      >
                        {c}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((r, ri) => {
                  const last = ri === compareRows.length - 1;
                  return (
                    <tr key={r.k}>
                      <td className="border-t border-zinc-200 px-1.5 py-2 text-left font-medium leading-tight text-zinc-700 sm:px-4 sm:py-3.5">
                        {r.k}
                      </td>
                      {r.v.map((val, ci) => {
                        const me = ci === 1;
                        return (
                          <td
                            key={ci}
                            className={`px-1 py-2 text-center leading-tight sm:px-4 sm:py-3.5 ${
                              me
                                ? `bg-indigo-50/80 font-semibold text-indigo-700 ${last ? "rounded-b-lg sm:rounded-b-2xl" : ""}`
                                : "border-t border-zinc-200 text-zinc-600"
                            }`}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* What you pay for — the one dark block on the page. Materials story +
          workshop photo up top, then the four things the price actually buys. */}
      <section className="bg-zinc-900 py-20 text-white sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("home.materialsTitle")}</h2>
              {/* Phones get the condensed paragraph: the full one reads as a wall
                  of text in a narrow column. CSS swap rather than a JS media
                  query so the server render stays deterministic. */}
              <p className="mt-4 text-sm leading-6 text-zinc-400 sm:hidden">
                {t("home.materialsBodyShort")}
              </p>
              <p className="mt-4 hidden text-sm leading-6 text-zinc-400 sm:block sm:text-base sm:leading-7">
                {t("home.materialsBody")}
              </p>
              {/* Board and edging suppliers. Both marks are dark-on-transparent,
                  so they're knocked out to white to read on the dark block.
                  Egger is a stacked lockup (rule + wordmark) against Kronospan's
                  single line, so it needs the taller box to look the same size. */}
              <div className="mt-8 flex items-center gap-7 sm:mt-9 sm:gap-9" aria-label={t("home.materialsSuppliers")}>
                <img
                  src="/img/logo-kronospan.png"
                  alt="Kronospan"
                  width={620}
                  height={124}
                  loading="lazy"
                  decoding="async"
                  className="h-6 w-auto opacity-80 brightness-0 invert sm:h-7"
                />
                <img
                  src="/img/logo-egger.png"
                  alt="Egger"
                  width={620}
                  height={143}
                  loading="lazy"
                  decoding="async"
                  className="h-7 w-auto opacity-80 brightness-0 invert sm:h-8"
                />
              </div>
            </Reveal>

            <Reveal delay={90}>
              {/* Shorter crop on phones so the photo never eats the screen, and
                  a landscape crop on desktop so the block stays wide, not tall. */}
              <div className="overflow-hidden rounded-2xl ring-1 ring-white/10 sm:rounded-3xl">
                <img
                  src="/img/carpenter.jpg"
                  alt={t("home.materialsTitle")}
                  width={1000}
                  height={1250}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[16/10] w-full object-cover sm:aspect-[3/2] lg:aspect-[4/3]"
                />
              </div>
            </Reveal>
          </div>

          <Reveal delay={60}>
            <div className="mt-14 grid grid-cols-2 gap-x-6 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-4">
              {MATERIAL_ICONS.map((path, idx) => (
                <div
                  key={idx}
                  className={`py-6 sm:py-0 ${idx % 2 === 1 ? "border-l border-white/10 pl-6 sm:border-l-0 sm:pl-0" : ""} ${
                    idx >= 2 ? "border-t border-white/10 sm:border-t-0" : ""
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{t(`home.materials.m${idx + 1}t`)}</h3>
                  <p className="mt-1.5 hidden text-sm leading-6 text-zinc-400 sm:block">{t(`home.materials.m${idx + 1}b`)}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ — token-driven accordion */}
      <section className="mx-auto w-full max-w-6xl px-5 py-24">
        <Reveal>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{t("home.faqTitle")}</h2>
        </Reveal>
        <Reveal delay={90}>
          <div className="mt-12">
            <FaqList />
          </div>
        </Reveal>
      </section>

      {/* Footer CTA — big, light, one primary action */}
      <section className="border-t border-zinc-200">
        <div className="mx-auto w-full max-w-6xl px-5 py-24 text-center">
          <Reveal>
            <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
              {t("home.footerCtaTitle")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-zinc-600">{t("home.footerCtaBody")}</p>
            <Link
              href="/design"
              onClick={() => posthog.capture("home_cta_clicked", { location: "footer" })}
              className="press mt-9 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-8 py-4 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {t("home.footerCta")}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Newsletter — compact capture band; the footer skips its own copy */}
      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto w-full max-w-6xl px-5 py-14">
          <Reveal>
            <NewsletterForm source="homepage" />
          </Reveal>
        </div>
      </section>

      <SiteFooter newsletter={false} />
    </div>
    </ReactionsProvider>
  );
}
