"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import {
  type Design,
  type Part,
  type Role,
  type Thickness,
  type Issue,
  COLOURS,
  LIMITS,
  DEFAULT_DESIGN,
  MAX_PARTS,
  MIN_PART_CM,
  thicknessCm,
  makeId,
  emptyDesign,
  scaleParts,
  validate,
  saveDesign,
  loadDesign,
} from "../../lib/design";
import { quoteDesign, breakdownCZK } from "../../lib/quote";
import { PRICING_DEBUG } from "../../lib/pricingConfig";
import { LIBRARY, type LibraryItem } from "../../lib/library";
import { useI18n, useT, type TFn } from "../../lib/i18n";
import { useRulesValidation } from "../../lib/rules-engine/useRulesValidation";
import { RulesFindings } from "../../components/RulesFindings";
import posthog from "posthog-js";

const INSPIRATION_PAGE_SIZE = 6;
const WALL = "#ece7df"; // brand material-world stage tone

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

function ViewerLoading() {
  const t = useT();
  return (
    <div className="flex h-[560px] w-full items-center justify-center bg-zinc-50 text-sm text-zinc-400">
      {t("design.loading")}
    </div>
  );
}

const ShelfViewer = dynamic(() => import("../../components/ShelfViewer"), {
  ssr: false,
  loading: () => <ViewerLoading />,
});

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

const THICKNESSES: Thickness[] = [18, 36];

// Translate a validation issue code into a localized sentence.
function issueText(t: TFn, iss: Issue): string {
  switch (iss.code) {
    case "floating":
      return t("validate.floating");
    case "tooMany":
      return t("validate.tooMany", { max: iss.value ?? 0 });
    case "maxEdge":
      return t("validate.maxEdge", { cm: iss.value ?? 0 });
    default: {
      const field = t(`design.${iss.field ?? "width"}`);
      if (iss.code === "nan") return t("validate.nan", { field });
      if (iss.code === "min") return t("validate.min", { field, value: iss.value ?? 0 });
      return t("validate.max", { field, value: iss.value ?? 0 });
    }
  }
}

// New part builders (parts connect to the carcass so the design stays valid).
function makePart(design: Design, role: Role): Part {
  const t = thicknessCm(design);
  const { w, h, d } = design.outerCm;
  if (role === "shelf") {
    return { id: makeId(), role, axis: "y", aCm: round1(Math.max(MIN_PART_CM, w - 2 * t)), bCm: d, pos: { x: 0, y: 0, z: 0 } };
  }
  if (role === "divider") {
    return { id: makeId(), role, axis: "x", aCm: round1(Math.max(MIN_PART_CM, h - 2 * t)), bCm: d, pos: { x: 0, y: 0, z: 0 } };
  }
  // wall: a full-height side board at the left outer face.
  return { id: makeId(), role: "wall", axis: "x", aCm: h, bCm: d, pos: { x: -w / 2 + t / 2, y: 0, z: 0 } };
}

export default function DesignPage() {
  const router = useRouter();
  const { t, fmt, locale } = useI18n();
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [priceOpen, setPriceOpen] = useState(false); // collapsed by default
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [inspirationCount, setInspirationCount] = useState(INSPIRATION_PAGE_SIZE);

  // Hydrate on the client only (after mount, to avoid a hydration mismatch
  // against the server-rendered default). A ?d=<slug> share link loads the
  // shared design from the server; otherwise fall back to localStorage.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("d");
    if (slug) {
      fetch(`/api/designs?slug=${encodeURIComponent(slug)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (body?.design) setDesign(body.design as Design);
          else setDesign(loadDesign());
        })
        .catch(() => setDesign(loadDesign()));
      return;
    }
    setDesign(loadDesign());
  }, []);

  // Save the current design server-side and copy a share link to the clipboard.
  async function shareDesign() {
    if (shareState === "loading") return;
    setShareState("loading");
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, locale }),
      });
      const body = await res.json();
      if (!res.ok || !body?.slug) throw new Error("save failed");
      const url = `${window.location.origin}/design?d=${body.slug}`;
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      posthog.capture("design_shared", { slug: body.slug, parts_count: design.parts.length });
    } catch {
      setShareState("error");
    } finally {
      setTimeout(() => setShareState("idle"), 2500);
    }
  }

  useEffect(() => {
    // The initial state is the shared DEFAULT_DESIGN constant (pre-hydration).
    // Never write it to storage: it would clobber a design handed over by the
    // library (/library) or a share link before the hydrate effect lands.
    if (design === DEFAULT_DESIGN) return;
    saveDesign(design);
  }, [design]);

  const quote = useMemo(() => quoteDesign(design), [design]);
  const v = useMemo(() => validate(design), [design]);
  const breakdown = useMemo(() => breakdownCZK(quote), [quote]);

  // Live rules-engine validation (sales-first): advisory recommendations, never
  // blocks an order inside the existing size envelope. Runs in a Web Worker.
  const rulesOptions = useMemo(() => ({ locale }), [locale]);
  const { report: rulesReport, validating: rulesValidating } = useRulesValidation(design, rulesOptions);
  // Part ids the engine flagged for the hovered finding — highlighted amber.
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);

  // Delete/Backspace removes the selected part (any part — no protected ones).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if (typing) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        setDesign((d) => ({ ...d, parts: d.parts.filter((p) => p.id !== selectedId) }));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  // Resize the outer box: proportionally scale the whole piece.
  function setOuter(patch: Partial<{ w: number; h: number; d: number }>) {
    setDesign((d) => scaleParts(d, { ...d.outerCm, ...patch }));
  }

  // Thickness change keeps the board thickness fixed for scaling but re-pins the
  // walls so they sit correctly at the new thickness.
  function setThickness(thickness: Thickness) {
    setDesign((d) => scaleParts({ ...d, thickness }, d.outerCm));
  }

  function startFromScratch() {
    setDesign((d) => emptyDesign({ colour: d.colour, thickness: d.thickness, outerCm: d.outerCm }));
    setSelectedId(null);
  }

  // Load a library design straight into the live editor (deep-cloned so the
  // shared LIBRARY array is never mutated by subsequent edits).
  function applyLibraryItem(item: LibraryItem) {
    setDesign(JSON.parse(JSON.stringify(item.design)) as Design);
    setSelectedId(null);
    posthog.capture("library_design_applied", { id: item.id, location: "design_page" });
  }

  function addPart(role: Role) {
    if (design.parts.length >= MAX_PARTS) return;
    const part = makePart(design, role);
    setDesign((d) => ({ ...d, parts: [...d.parts, part] }));
    setSelectedId(part.id);
    posthog.capture("part_added", { role, total_parts: design.parts.length + 1 });
  }

  function goToOrder() {
    if (!v.ok) return;
    saveDesign(design);
    posthog.capture("order_initiated", {
      width_cm: design.outerCm.w,
      height_cm: design.outerCm.h,
      depth_cm: design.outerCm.d,
      colour: design.colour,
      thickness_mm: design.thickness,
      parts_count: design.parts.length,
      price_czk: quote.customerCZK,
    });
    router.push("/order");
  }

  const { w, h, d } = design.outerCm;
  const tinyParts = design.thickness === 36 && design.parts.some((p) => Math.min(p.aCm, p.bCm) < 30);

  return (
    <main className="min-h-screen bg-zinc-50 pb-40 text-zinc-900 lg:pb-0">
      <SiteHeader variant="app" />

      <div className="mx-auto w-full max-w-7xl px-5 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("design.title")}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-zinc-600">{t("design.subtitle")}</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left column: the 3D view, then inspiration below it — sized to its
              own content (items-start on the grid) instead of stretching to
              match the taller controls column. */}
          <div className="flex flex-col gap-6">
            {/* Full-width 3D view with floating add controls on the canvas */}
            <section className="relative overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200">
              <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
                <FloatBtn onClick={() => addPart("shelf")} tone="indigo">＋ {t("design.addShelf")}</FloatBtn>
                <FloatBtn onClick={() => addPart("divider")} tone="dark">＋ {t("design.addDivider")}</FloatBtn>
                <FloatBtn onClick={() => addPart("wall")} tone="dark">＋ {t("design.addWall")}</FloatBtn>
                <FloatBtn onClick={startFromScratch} tone="ghost">{t("design.clear")}</FloatBtn>
                <FloatBtn onClick={shareDesign} tone="ghost">
                  {shareState === "copied" ? t("design.shareCopied") : shareState === "error" ? t("design.shareErr") : t("design.share")}
                </FloatBtn>
              </div>
              <ShelfViewer
                design={design}
                height={560}
                interactive
                editable
                autoRotate={false}
                selectedId={selectedId}
                floatingIds={[...v.floatingIds, ...flaggedIds]}
                onSelect={setSelectedId}
                onChange={setDesign}
              />
              {v.floatingIds.length > 0 && (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-amber-500/95 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur">
                  {t("design.floating")}
                </div>
              )}
            </section>

            {/* Inspiration — the design library, inline. Click a card to load
                it straight into the editor above. */}
            <section className="rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">{t("design.inspirationTitle")}</h2>
                  <p className="mt-1 max-w-md text-sm text-zinc-600">{t("design.inspirationBody")}</p>
                </div>
                <Link
                  href="/library"
                  className="press shrink-0 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  {t("design.inspirationBrowseAll")}
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {LIBRARY.slice(0, inspirationCount).map((item) => (
                  <InspirationCard key={item.id} item={item} onUse={() => applyLibraryItem(item)} />
                ))}
              </div>

              {inspirationCount < LIBRARY.length && (
                <button
                  type="button"
                  onClick={() => setInspirationCount((n) => Math.min(LIBRARY.length, n + INSPIRATION_PAGE_SIZE))}
                  className="press mt-5 inline-flex items-center justify-center rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                >
                  {t("design.inspirationShowMore")}
                </button>
              )}
            </section>
          </div>

          {/* Controls */}
          <aside className="space-y-5">
            {/* PROMINENT furniture-size panel */}
            <div className="rounded-3xl bg-white p-6 ring-1 ring-indigo-200 shadow-sm">
              <div className="flex items-baseline justify-between">
                <p className="text-base font-semibold text-zinc-900">{t("design.size")}</p>
                <p className="text-sm font-semibold tabular-nums text-indigo-600">{w} × {h} × {d} cm</p>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{t("design.sizeHint")}</p>
              <div className="mt-4 space-y-4">
                <SizeControl label={t("design.width")} value={w} lim={LIMITS.w} onChange={(n) => setOuter({ w: n })} />
                <SizeControl label={t("design.height")} value={h} lim={LIMITS.h} onChange={(n) => setOuter({ h: n })} />
                <SizeControl label={t("design.depth")} value={d} lim={LIMITS.d} onChange={(n) => setOuter({ d: n })} />
              </div>
              {v.errors.length > 0 && (
                <ul className="mt-4 space-y-1 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-100">
                  {v.errors.map((e, i) => <li key={i}>• {issueText(t, e)}</li>)}
                </ul>
              )}
              {v.warnings.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-amber-100">
                  {v.warnings.map((wn, i) => <li key={i}>• {issueText(t, wn)}</li>)}
                </ul>
              )}
            </div>

            {/* Engineering recommendations from the rules engine (advisory). */}
            <RulesFindings report={rulesReport} validating={rulesValidating} onHighlight={setFlaggedIds} />

            {/* Material: colour + thickness */}
            <div className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200">
              <p className="text-sm font-semibold text-zinc-900">{t("design.material")}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {COLOURS.map((c) => {
                  const active = design.colour === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setDesign((cur) => ({ ...cur, colour: c.id }));
                        posthog.capture("colour_selected", { colour: c.id });
                      }}
                      className={`flex items-center gap-2 rounded-2xl border p-3 transition ${
                        active ? "border-indigo-500 bg-indigo-50/50" : "border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      <span className="h-7 w-7 rounded-full ring-1 ring-black/10" style={{ backgroundColor: c.hex }} />
                      <span className="text-sm font-medium text-zinc-700">{t(`colors.${c.id}`)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-xs font-medium text-zinc-600">{t("design.thickness")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {THICKNESSES.map((th) => {
                  const active = design.thickness === th;
                  return (
                    <button
                      key={th}
                      onClick={() => {
                        setThickness(th);
                        posthog.capture("thickness_selected", { thickness_mm: th });
                      }}
                      className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                        active ? "border-indigo-500 bg-indigo-50/50 text-indigo-700" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {th} mm
                    </button>
                  );
                })}
              </div>
              {tinyParts && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-amber-100">
                  {t("design.thick36Warn")}
                </p>
              )}
            </div>

            {/* Collapsible price + order (desktop) */}
            <div className="hidden lg:block">
              <PricePanel
                quote={quote}
                breakdown={breakdown}
                open={priceOpen}
                onToggle={() => setPriceOpen((o) => !o)}
                bandBack={design.bandBack}
                onBandBack={(v2) => setDesign((cur) => ({ ...cur, bandBack: v2 }))}
                canOrder={v.ok}
                onOrder={goToOrder}
              />
            </div>
          </aside>
        </div>
      </div>

      <SiteFooter />

      {/* Sticky price bar (mobile) — collapsed by default, expandable to breakdown */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden">
        {priceOpen && (
          <div className="mx-auto w-full max-w-7xl px-5 pt-4">
            <Breakdown quote={quote} breakdown={breakdown} />
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={!design.bandBack}
                onChange={(e) => setDesign((cur) => ({ ...cur, bandBack: !e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300"
              />
              {t("design.dontBandBack")}
            </label>
          </div>
        )}
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-3">
          <button onClick={() => setPriceOpen((o) => !o)} className="text-left">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              {t("design.priceVat")} <span className="text-zinc-400">{priceOpen ? "⌃" : "⌄"}</span>
            </p>
            <p className="text-lg font-semibold leading-none">{fmt(quote.kitCZK)}</p>
          </button>
          <button
            onClick={goToOrder}
            disabled={!v.ok}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {t("design.orderShort")}
          </button>
        </div>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- pieces */

/** Mounts the WebGL viewer only while the card is near the viewport, so a row
 *  of inspiration thumbnails never holds more live GL contexts than visible. */
function InspirationCard({ item, onUse }: { item: LibraryItem; onUse: () => void }) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <button
      type="button"
      onClick={onUse}
      className="card-lift group block overflow-hidden rounded-2xl bg-[#ece7df] text-left ring-1 ring-zinc-200"
      aria-label={`${t(`library.items.${item.id}.n`)}, ${t("design.inspirationUse")}`}
    >
      <div ref={ref} className="relative flex aspect-square items-center justify-center overflow-hidden">
        {visible && (
          <ShelfViewer design={item.design} background={WALL} height={200} interactive={false} autoRotate={!reduced} lite />
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-zinc-900">{t(`library.items.${item.id}.n`)}</p>
        <p className="mt-0.5 text-xs font-medium text-indigo-600 transition-colors group-hover:text-indigo-500">
          {t("design.inspirationUse")}
        </p>
      </div>
    </button>
  );
}

function FloatBtn({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "indigo" | "dark" | "ghost";
}) {
  const cls =
    tone === "indigo"
      ? "bg-indigo-600/90 text-white hover:bg-indigo-600"
      : tone === "dark"
        ? "bg-zinc-900/85 text-white hover:bg-zinc-900"
        : "bg-white/85 text-zinc-700 ring-1 ring-zinc-200 hover:bg-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pointer-events-auto inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold backdrop-blur transition ${cls}`}
    >
      {children}
    </button>
  );
}

function SizeControl({
  label,
  value,
  lim,
  onChange,
}: {
  label: string;
  value: number;
  lim: { min: number; max: number };
  onChange: (n: number) => void;
}) {
  const set = (n: number) => onChange(clampN(Math.round(n), lim.min, lim.max));
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        <div className="flex items-center rounded-lg border border-zinc-300 focus-within:border-indigo-500">
          <input
            type="number"
            inputMode="numeric"
            value={Number.isNaN(value) ? "" : value}
            min={lim.min}
            max={lim.max}
            onChange={(e) => set(Number(e.target.value))}
            className="w-14 bg-transparent px-2 py-1 text-right text-sm tabular-nums outline-none"
            aria-label={label}
          />
          <span className="pr-2 text-xs text-zinc-400">cm</span>
        </div>
      </div>
      <input
        type="range"
        min={lim.min}
        max={lim.max}
        value={Number.isNaN(value) ? lim.min : value}
        onChange={(e) => set(Number(e.target.value))}
        className="mt-2 w-full accent-indigo-600"
        aria-label={label}
      />
    </div>
  );
}

function PricePanel({
  quote,
  breakdown,
  open,
  onToggle,
  bandBack,
  onBandBack,
  canOrder,
  onOrder,
}: {
  quote: ReturnType<typeof quoteDesign>;
  breakdown: ReturnType<typeof breakdownCZK>;
  open: boolean;
  onToggle: () => void;
  bandBack: boolean;
  onBandBack: (v: boolean) => void;
  canOrder: boolean;
  onOrder: () => void;
}) {
  const { t, fmt } = useI18n();
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200">
      <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <span className="text-sm text-zinc-600">{t("design.priceLabel")}</span>
        <span className="flex items-center gap-2">
          <span className="text-2xl font-semibold">{fmt(quote.kitCZK)}</span>
          <span className="text-zinc-400">{open ? "⌃" : "⌄"}</span>
        </span>
      </button>

      {open && (
        <div className="mt-4">
          <Breakdown quote={quote} breakdown={breakdown} />
        </div>
      )}

      {!open && <p className="mt-1 text-xs text-zinc-500">{t("design.plusDelivery", { price: fmt(quote.deliveryCZK) })}</p>}

      <label className="mt-4 flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={!bandBack}
          onChange={(e) => onBandBack(!e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300"
        />
        {t("design.dontBandBack")}
      </label>

      <button
        onClick={onOrder}
        disabled={!canOrder}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {t("design.order")}
      </button>
    </div>
  );
}

function Breakdown({
  quote,
  breakdown,
}: {
  quote: ReturnType<typeof quoteDesign>;
  breakdown: ReturnType<typeof breakdownCZK>;
}) {
  const { t, fmt } = useI18n();
  return (
    <div className="space-y-2 rounded-2xl bg-zinc-50 p-4 text-sm">
      {breakdown.map((l) => (
        <div key={l.key} className="flex items-center justify-between gap-4">
          <span className="text-zinc-600">
            {t(`breakdown.${l.key}`)}
            {l.estimate && <span className="ml-1 text-xs text-zinc-400">({t("breakdown.estimate")})</span>}
          </span>
          <span className="tabular-nums text-zinc-800">{fmt(l.czk)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-2">
        <span className="text-zinc-600">{t("design.bdKit")}</span>
        <span className="font-semibold tabular-nums">{fmt(quote.kitCZK)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-zinc-600">{t("common.delivery")}</span>
        <span className="tabular-nums text-zinc-800">{fmt(quote.deliveryCZK)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-2">
        <span className="font-semibold text-zinc-900">{t("design.bdTotal")}</span>
        <span className="text-base font-semibold tabular-nums">{fmt(quote.customerCZK)}</span>
      </div>
      <p className="pt-1 text-xs text-zinc-400">{t("design.cuttingNote")}</p>
      {PRICING_DEBUG && (
        <div
          className={`mt-2 rounded-lg px-2 py-1 font-mono text-[11px] ${
            quote.exceedsWTP ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          admin · margin {(quote.marginPct * 100).toFixed(1)}% · landed{" "}
          {fmt(Math.round(quote.landedCZK))} · meble {quote.mebleCostPLN} PLN
          {quote.wtpCeilingCZK != null && (
            <>
              {" "}
              · WTP ≤ {fmt(quote.wtpCeilingCZK)}
              {quote.exceedsWTP ? " ⚠︎ over ceiling" : ""}
            </>
          )}
          {quote.vatRegistered ? " · VAT-reg" : ""}
        </div>
      )}
    </div>
  );
}
