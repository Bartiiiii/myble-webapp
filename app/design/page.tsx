"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { ShareDialog } from "../../components/design/ShareDialog";
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
  MAX_PART_CM,
  MIN_TO_ALIGN,
  thicknessCm,
  makeId,
  emptyDesign,
  nudgeClear,
  partSize,
  faceAxes,
  resizedPart,
  filledPart,
  type SizeField,
  type Axis,
  scaleParts,
  alignParts,
  distributeParts,
  type AlignTo,
  validate,
  saveDesign,
  loadDesign,
} from "../../lib/design";
import { quoteDesign, breakdownCZK } from "../../lib/quote";
import { PRICING_DEBUG } from "../../lib/pricingConfig";
import { LIBRARY, type LibraryItem } from "../../lib/library";
import { useI18n, useT, type TFn } from "../../lib/i18n";
import { FRONT_FRAME, type MoveFrame } from "../../lib/viewAxes";
import { useUndoable, useUndoRedoKeys } from "../../lib/history";
import { ArrangeMenu, type AlignDir } from "../../components/design/ArrangeMenu";
import posthog from "posthog-js";

const INSPIRATION_PAGE_SIZE = 6;
// Where a pending "I was about to share this" survives the sign-in round trip
// (Google, and for a first-timer the /welcome profile step on top of it).
const SHARE_INTENT_KEY = "myble.share.intent";
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
    default: {
      const field = t(`design.${iss.field ?? "width"}`);
      if (iss.code === "nan") return t("validate.nan", { field });
      if (iss.code === "min") return t("validate.min", { field, value: iss.value ?? 0 });
      return t("validate.max", { field, value: iss.value ?? 0 });
    }
  }
}

// New part builders (parts connect to the carcass so the design stays valid).
/**
 * How far the proportional-size sliders may run.
 *
 * Scaling stretches every board with the piece, so it can only carry the piece
 * as far as its longest board can stretch — past that the boards stop at the
 * cut/ship ceiling and a carcass simply falls apart, shelves stranded in the
 * middle of a bay they can no longer reach. A wider piece than that is made of
 * MORE boards, not longer ones: drag a board out, or add one.
 *
 * The floor is never below the piece's current size, so something already built
 * out by hand still shows honestly on the slider and can be scaled back down.
 */
function scaleLim(dim: "w" | "h" | "d", current: number): { min: number; max: number } {
  return {
    min: LIMITS[dim].min,
    max: Math.max(Math.min(LIMITS[dim].max, MAX_PART_CM), Math.round(current)),
  };
}

function makePart(design: Design, role: Role): Part {
  const t = thicknessCm(design);
  const { w, h, d } = design.outerCm;
  // A new board spans its bay, but never past what can be cut and shipped: on a
  // piece wider than one board it arrives at full board length, to be joined.
  const cut = (n: number) => round1(clampN(n, MIN_PART_CM, MAX_PART_CM));
  if (role === "shelf") {
    return { id: makeId(), role, axis: "y", aCm: cut(w - 2 * t), bCm: cut(d), pos: { x: 0, y: 0, z: 0 } };
  }
  if (role === "divider") {
    return { id: makeId(), role, axis: "x", aCm: cut(h - 2 * t), bCm: cut(d), pos: { x: 0, y: 0, z: 0 } };
  }
  // wall: a full-height side board at the left outer face.
  return { id: makeId(), role: "wall", axis: "x", aCm: cut(h), bCm: cut(d), pos: { x: -w / 2 + t / 2, y: 0, z: 0 } };
}

export default function DesignPage() {
  const router = useRouter();
  const { t, fmt, locale } = useI18n();
  const { data: session } = useSession();
  // Every edit below goes through this, so undo/redo covers the whole editor
  // rather than a hand-picked list of actions.
  const {
    value: design,
    set: setDesign,
    reset: loadIntoEditor,
    setGesture,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoable<Design>(DEFAULT_DESIGN);
  useUndoRedoKeys(undo, redo);
  // A selection, not a single board: aligning and distributing need a group.
  // Most of the editor still works on exactly one board, so `selectedId` stays
  // as the single-selection view of it.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  /** Click replaces the selection; shift/⌘ toggles a board in or out of it. */
  const selectPart = useCallback((id: string | null, extend = false) => {
    setSelectedIds((cur) => {
      if (id === null) return cur.length === 0 ? cur : [];
      if (!extend) return cur.length === 1 && cur[0] === id ? cur : [id];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
  }, []);
  const setSelectedId = useCallback(
    (id: string | null) => selectPart(id, false),
    [selectPart],
  );
  // Which two axes the camera currently puts on screen — the viewer decides it
  // from the camera, we only name them for the user.
  const [moveFrame, setMoveFrame] = useState<MoveFrame>(FRONT_FRAME);
  // Right-click menu on the canvas, positioned where the click landed. Only
  // ever opened for a group: on one board there is nothing to arrange.
  const [arrangeAt, setArrangeAt] = useState<{ x: number; y: number } | null>(null);
  const [priceOpen, setPriceOpen] = useState(false); // collapsed by default
  const [shareOpen, setShareOpen] = useState(false);
  // Which half of the share dialog to land on. Normally the chooser; after a
  // sign-in that started in the community form, straight back to that form.
  const [sharePanel, setSharePanel] = useState<"choose" | "community">("choose");
  const [saveState, setSaveState] = useState<"idle" | "loading" | "done" | "error">("idle");
  // The slug this design was loaded from (a share link) or already saved
  // under this session — lets saveToAccount() claim/update that row instead
  // of inserting a duplicate on every click.
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [inspirationCount, setInspirationCount] = useState(INSPIRATION_PAGE_SIZE);

  // The board the editor has selected, if any: it gets its own size box above
  // the furniture one. Declared up here so the editing helpers below can close
  // over it.
  const selectedPart = design.parts.find((p) => p.id === selectedId) ?? null;
  // Undo, delete and "clear" can all take a selected board away with them.
  const liveIds = selectedIds.filter((id) => design.parts.some((p) => p.id === id));
  const selection = liveIds.length === selectedIds.length ? selectedIds : liveIds;

  // Hydrate on the client only (after mount, to avoid a hydration mismatch
  // against the server-rendered default). A ?d=<slug> share link loads the
  // shared design from the server; otherwise fall back to localStorage.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("d");
    if (slug) {
      fetch(`/api/designs?slug=${encodeURIComponent(slug)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (body?.design) {
            loadIntoEditor(body.design as Design);
            setCurrentSlug(slug);
          } else {
            loadIntoEditor(loadDesign());
          }
        })
        .catch(() => loadIntoEditor(loadDesign()));
      return;
    }
    loadIntoEditor(loadDesign());
  }, [loadIntoEditor]);

  // Coming back from Google: ?share= is the intent the person left with, put
  // there by the share dialog's sign-in link. Reopen the dialog where they
  // were and strip the marker, so a reload doesn't pop it up again.
  //
  // A first-time sign-in takes one more hop — providers.tsx sends people
  // without a profile to /welcome and back — so the intent is parked in
  // sessionStorage for the round trip rather than carried in the URL alone.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("share");
    const intent = fromUrl ?? sessionStorage.getItem(SHARE_INTENT_KEY);
    if (fromUrl) {
      sessionStorage.setItem(SHARE_INTENT_KEY, fromUrl);
      params.delete("share");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    }
    if (!intent) return;
    setSharePanel(intent === "community" ? "community" : "choose");
    setShareOpen(true);
    // Deliberately kept in sessionStorage until the dialog is closed: a
    // first-timer is still one /welcome hop away from actually seeing it.
  }, []);

  /** Closing the dialog is the one signal that the pending intent is spent. */
  const closeShare = useCallback(() => {
    sessionStorage.removeItem(SHARE_INTENT_KEY);
    setShareOpen(false);
  }, []);

  // "Share" opens a chooser (components/design/ShareDialog.tsx): a picture or
  // a spinning clip to send to someone, or a submission to the Design Library
  // that waits for approval. It used to copy a link and nothing else, which
  // covered neither intention well.
  function openShare() {
    setSharePanel("choose");
    setShareOpen(true);
    posthog.capture("design_share_opened", { parts_count: design.parts.length });
  }

  // Save the current design to the signed-in customer's account (My Account →
  // My Designs). Auto-named from the piece's own dimensions rather than a
  // naming prompt, so saving stays a single click like sharing already is —
  // it can be renamed later from the Designs tab.
  async function saveToAccount() {
    if (saveState === "loading") return;
    setSaveState("loading");
    try {
      const { w, h, d } = design.outerCm;
      const name = `${Math.round(w)}×${Math.round(h)}×${Math.round(d)} cm`;
      const res = await fetch("/api/account/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, locale, name, slug: currentSlug ?? undefined }),
      });
      const body = await res.json();
      if (!res.ok || !body?.slug) throw new Error("save failed");
      setCurrentSlug(body.slug);
      setSaveState("done");
      posthog.capture("design_saved_to_account", { slug: body.slug, parts_count: design.parts.length });
    } catch {
      setSaveState("error");
    } finally {
      setTimeout(() => setSaveState("idle"), 2500);
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

  // The rules engine's advisory recommendations no longer live here. A panel of
  // expert caveats beside a piece you are still shaping reads as "something is
  // wrong" while you are only exploring; the same advice meets the customer at
  // checkout, where it is a decision rather than an interruption.

  // Delete/Backspace removes the selected part (any part — no protected ones).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if (typing) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        e.preventDefault();
        setDesign((d) => ({ ...d, parts: d.parts.filter((p) => !selectedIds.includes(p.id)) }));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, setDesign, setSelectedId]);

  useEffect(() => {
    if (!arrangeAt) return;
    const close = () => setArrangeAt(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [arrangeAt]);

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
    // The id is fixed out here so we can select the new board, but the board
    // itself is built inside the updater: two taps in one React batch would
    // otherwise both measure the same stale parts list and stack on each other.
    const id = makeId();
    setDesign((d) => {
      if (d.parts.length >= MAX_PARTS) return d;
      // A new board lands in the middle of the piece, which is often already
      // occupied. Boards are solid, so shift it to the nearest free slot along
      // its own thickness axis rather than dropping it inside another board.
      const fresh = { ...makePart(d, role), id };
      const t = thicknessCm(d);
      // Keep the search inside the carcass: the board's centre may travel until
      // its face reaches the outer edge, no further.
      const axisIdx = ({ x: 0, y: 1, z: 2 } as const)[fresh.axis];
      const half = d.outerCm[({ x: "w", y: "h", z: "d" } as const)[fresh.axis]] / 2;
      const halfSize = partSize(fresh, t)[axisIdx] / 2;
      const range = { min: -half + halfSize, max: half - halfSize };
      return { ...d, parts: [...d.parts, nudgeClear(fresh, d.parts, t, range)] };
    });
    setSelectedId(id);
    posthog.capture("part_added", { role, total_parts: design.parts.length + 1 });
  }

  // Resize the selected board along one of its two face axes. Boards are solid,
  // so a value that would grow it into a neighbour is simply not applied — the
  // slider stops where the board stops.
  // Both size edits go through the geometry engine (lib/geometry/resize.ts),
  // which owns the two contact rules: a board with one joint resizes from its
  // free side, and "fill" matches a shorter neighbour before it reaches for the
  // full span between the walls.
  function applyToSelected(next: Part | null) {
    if (!next) return; // the size doesn't fit — leave the design alone
    setDesign((d) => ({ ...d, parts: d.parts.map((p) => (p.id === next.id ? next : p)) }));
  }

  function resizePart(field: SizeField, value: number) {
    if (!selectedPart) return;
    const t = thicknessCm(design);
    const others = design.parts.filter((p) => p.id !== selectedPart.id);
    applyToSelected(resizedPart(selectedPart, field, value, others, t, design.outerCm));
  }

  function fillPart(field: SizeField) {
    if (!selectedPart) return;
    const t = thicknessCm(design);
    const others = design.parts.filter((p) => p.id !== selectedPart.id);
    applyToSelected(filledPart(selectedPart, field, others, t, design.outerCm));
  }

  // Align and distribute work on the two axes the camera has put on screen, so
  // "left" is the left the user is looking at however the piece is turned.
  function alignSelection(dir: AlignDir) {
    const horizontal = dir === "left" || dir === "centre" || dir === "right";
    const axis = horizontal ? moveFrame.h : moveFrame.v;
    const sign = horizontal ? moveFrame.hSign : moveFrame.vSign;
    let to: AlignTo = "centre";
    if (dir === "left" || dir === "bottom") to = sign > 0 ? "min" : "max";
    if (dir === "right" || dir === "top") to = sign > 0 ? "max" : "min";
    setDesign((d) => ({ ...d, parts: alignParts(d.parts, selection, axis, to, thicknessCm(d)) }));
  }

  function distributeSelection(horizontal: boolean) {
    const axis = horizontal ? moveFrame.h : moveFrame.v;
    setDesign((d) => ({ ...d, parts: distributeParts(d.parts, selection, axis, thicknessCm(d)) }));
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
    <main className="no-text-select min-h-screen bg-zinc-50 pb-40 text-zinc-900 lg:pb-0">
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
            <section
              className="relative overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200"
              onContextMenu={(e) => {
                // Only take over the browser's menu when we have something to
                // put in its place.
                if (selection.length < MIN_TO_ALIGN) return;
                e.preventDefault();
                const box = e.currentTarget.getBoundingClientRect();
                setArrangeAt({ x: e.clientX - box.left, y: e.clientY - box.top });
              }}
            >
              {/* One square button per side of the canvas: add a board on the
                  left, everything else behind a menu on the right. */}
              {/* z-20: above the viewer's docked board controls, so the menu's
                  dropdown covers them rather than opening behind. */}
              <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between">
                <SquareBtn
                  onClick={() => addPart("shelf")}
                  tone="indigo"
                  label={t("design.addPart")}
                  disabled={design.parts.length >= MAX_PARTS}
                >
                  <PlusIcon />
                </SquareBtn>
                <div className="pointer-events-auto flex items-center gap-2">
                  <ShareBtn onClick={openShare} label={t("design.share")} />
                  <ActionMenu
                    label={t("design.menu")}
                    nav={{
                      back: { label: t("design.undo"), onClick: undo, disabled: !canUndo },
                      forward: { label: t("design.redo"), onClick: redo, disabled: !canRedo },
                    }}
                    items={[
                      { key: "clear", text: t("design.clear"), onClick: startFromScratch },
                      ...(session?.user
                        ? [{
                            key: "save",
                            text: saveState === "done" ? t("design.saveDone") : saveState === "error" ? t("design.saveErr") : t("design.save"),
                            onClick: saveToAccount,
                          }]
                        : []),
                    ]}
                    arrange={
                      selection.length >= MIN_TO_ALIGN
                        ? (close) => (
                            <ArrangeMenu
                              count={selection.length}
                              onAlign={alignSelection}
                              onDistribute={distributeSelection}
                              translate={t}
                              onDone={close}
                            />
                          )
                        : undefined
                    }
                  />
                </div>
              </div>
              <ShelfViewer
                design={design}
                height={560}
                interactive
                editable
                autoRotate={false}
                selectedIds={selection}
                floatingIds={v.floatingIds}
                onSelect={selectPart}
                onChange={setDesign}
                onMoveFrame={setMoveFrame}
                onGesture={setGesture}
              />
              <MoveAxesBadge frame={moveFrame} />

              {arrangeAt && selection.length >= MIN_TO_ALIGN && (
                <div
                  className="absolute z-30 w-56 overflow-hidden rounded-2xl bg-white/95 shadow-xl ring-1 ring-zinc-200 backdrop-blur"
                  style={{ left: Math.min(arrangeAt.x, 520), top: Math.min(arrangeAt.y, 380) }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <p className="border-b border-zinc-100 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    {t("arrange.selected", { n: selection.length })}
                  </p>
                  <ArrangeMenu
                    count={selection.length}
                    onAlign={alignSelection}
                    onDistribute={distributeSelection}
                    translate={t}
                    onDone={() => setArrangeAt(null)}
                  />
                </div>
              )}

              {v.floatingIds.length > 0 && (
                /* Desktop: overlaid on the bottom of the canvas, where nothing
                   else docks. On a phone it sits under the canvas instead (next
                   block), so it never covers the board pad or the piece. */
                <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 hidden rounded-2xl bg-amber-500/95 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur lg:block">
                  {t("design.floating")}
                </div>
              )}
            </section>

            {v.floatingIds.length > 0 && (
              <div role="status" className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-medium text-white shadow-sm lg:hidden">
                {t("design.floating")}
              </div>
            )}

            {/* Inspiration — the design library, inline. Click a card to load
                it straight into the editor above. Desktop keeps it under the
                viewer; on mobile it moves to the very bottom of the page (the
                second instance below), so the size + material controls come
                first on a phone. */}
            <Inspiration
              className="hidden lg:block"
              count={inspirationCount}
              onShowMore={() => setInspirationCount((n) => Math.min(LIBRARY.length, n + INSPIRATION_PAGE_SIZE))}
              onUse={applyLibraryItem}
            />
          </div>

          {/* Controls */}
          <aside className="space-y-5">
            {/* Selected board: its own size box, above the furniture one so the
                piece dimensions stay put rather than being swapped out. */}
            {/* With a group selected there is no one board to size, so the board
                panel steps aside and says what the selection can do instead. */}
            {selection.length >= MIN_TO_ALIGN && (
              <div className="rounded-3xl bg-white p-6 ring-1 ring-indigo-300 shadow-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-base font-semibold text-zinc-900">
                    {t("arrange.selected", { n: selection.length })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="shrink-0 text-sm font-semibold text-indigo-600 transition hover:text-indigo-500"
                  >
                    {t("design.partDone")}
                  </button>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{t("arrange.hint")}</p>
                <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-zinc-200">
                  <ArrangeMenu
                    count={selection.length}
                    onAlign={alignSelection}
                    onDistribute={distributeSelection}
                    translate={t}
                  />
                </div>
              </div>
            )}

            {selectedPart && (
              <BoardSizePanel
                part={selectedPart}
                design={design}
                onResize={resizePart}
                onFill={fillPart}
                onDone={() => setSelectedId(null)}
              />
            )}

            {/* PROMINENT furniture-size panel */}
            <div className="rounded-3xl bg-white p-6 ring-1 ring-indigo-200 shadow-sm">
              <div className="flex items-baseline justify-between">
                <p className="text-base font-semibold text-zinc-900">{t("design.size")}</p>
                <p className="text-sm font-semibold tabular-nums text-indigo-600">{w} × {h} × {d} cm</p>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{t("design.sizeHint")}</p>
              <div className="mt-4 space-y-4">
                <SizeControl label={t("design.width")} value={w} lim={scaleLim("w", w)} onChange={(n) => setOuter({ w: n })} />
                <SizeControl label={t("design.height")} value={h} lim={scaleLim("h", h)} onChange={(n) => setOuter({ h: n })} />
                <SizeControl label={t("design.depth")} value={d} lim={scaleLim("d", d)} onChange={(n) => setOuter({ d: n })} />
              </div>
              {v.errors.length > 0 && (
                <ul className="mt-4 space-y-1 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-100">
                  {v.errors.map((e, i) => <li key={i}>• {issueText(t, e)}</li>)}
                </ul>
              )}
            </div>

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
                canOrder={v.ok}
                onOrder={goToOrder}
              />
            </div>
          </aside>

          {/* Inspiration, mobile placement: last thing on the page. Hidden on
              desktop (where the copy above the viewer carries it), so no second
              set of WebGL thumbnails is ever mounted. */}
          <Inspiration
            className="lg:hidden"
            mobile
            count={inspirationCount}
            onShowMore={() => setInspirationCount((n) => Math.min(LIBRARY.length, n + INSPIRATION_PAGE_SIZE))}
            onUse={applyLibraryItem}
          />
        </div>
      </div>

      <SiteFooter />

      {/* Share — picture/clip for a chat, or a submission to the library. */}
      <ShareDialog
        open={shareOpen}
        onClose={closeShare}
        design={design}
        currentSlug={currentSlug}
        initialPanel={sharePanel}
        onShared={(slug) => setCurrentSlug(slug)}
      />

      {/* Sticky price bar (mobile) — collapsed by default, expandable to breakdown */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden">
        {priceOpen && (
          <div className="mx-auto w-full max-w-7xl px-5 pt-4">
            <Breakdown quote={quote} breakdown={breakdown} />
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

/** The inline design library. Rendered twice — once for desktop, once for
 *  mobile — because the two layouts want it in different places on the page.
 *  Only one is ever displayed, and a `display:none` copy never intersects the
 *  viewport, so its cards stay unmounted and cost no GL context. */
function Inspiration({
  className,
  mobile = false,
  count,
  onShowMore,
  onUse,
}: {
  className: string;
  mobile?: boolean;
  count: number;
  onShowMore: () => void;
  onUse: (item: LibraryItem) => void;
}) {
  const t = useT();
  return (
    <section className={`rounded-3xl bg-white p-6 ring-1 ring-zinc-200 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            {t(mobile ? "design.inspirationTitleMobile" : "design.inspirationTitle")}
          </h2>
          {/* The subtitle is desktop-only: on a phone the cards explain
              themselves and the line just ate a row of screen. */}
          {!mobile && <p className="mt-1 max-w-md text-sm text-zinc-600">{t("design.inspirationBody")}</p>}
        </div>
        <Link href="/library" className="press shrink-0 text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          {t("design.inspirationBrowseAll")}
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {LIBRARY.slice(0, count).map((item) => (
          <InspirationCard key={item.id} item={item} onUse={() => onUse(item)} />
        ))}
      </div>

      {count < LIBRARY.length && (
        <button
          type="button"
          onClick={onShowMore}
          className="press mt-5 inline-flex w-full items-center justify-center rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
        >
          {t("design.inspirationShowMore")}
        </button>
      )}
    </section>
  );
}

/** Mounts the WebGL viewer only while the card is near the viewport, so a row
 *  of inspiration thumbnails never holds more live GL contexts than visible. */
function InspirationCard({ item, onUse }: { item: LibraryItem; onUse: () => void }) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);

  // A ref callback rather than an effect: the node arrives at commit time, so
  // nothing reads ref.current and nothing sets state from inside an effect.
  const observe = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true); // no observer support: just render it
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
      <div ref={observe} className="relative flex aspect-square items-center justify-center overflow-hidden">
        {visible && (
          <ShelfViewer design={item.design} background={WALL} height={200} interactive={false} autoRotate={!reduced} lite />
        )}
      </div>
      {/* White strip under the thumbnail, so the name reads as a caption rather
          than floating on the warm stage tone. */}
      <div className="border-t border-zinc-200/70 bg-white p-3">
        <p className="truncate text-sm font-semibold text-zinc-900">{t(`library.items.${item.id}.n`)}</p>
        <p className="mt-0.5 text-xs font-medium text-indigo-600 transition-colors group-hover:text-indigo-500">
          {t("design.inspirationUse")}
        </p>
      </div>
    </button>
  );
}

/** Names the two axes the board controls are currently working in. Sits beside
 *  the add button because that is where the eye already is when placing a
 *  board, and reads in the same vocabulary as the size panels: width, height,
 *  depth — never x, y, z.
 *
 *  Bare text, no plate behind it — which leaves it to survive whatever the user
 *  zooms the piece into. Rather than watching the canvas and switching between
 *  a light and a dark colour, it is drawn in mid grey and composited with
 *  `difference`: the result is |backdrop − grey|, which lands near mid grey
 *  against white board, black board and empty canvas alike. It reads the same
 *  soft grey everywhere, so it never flips brightness as the piece turns, and
 *  never has to shout to stay legible.
 *
 *  It has to paint AFTER the canvas for that: a blended element only sees the
 *  backdrop inside its own stacking context, and the controls row above sets a
 *  z-index, which would isolate it from the very thing it needs to read. */
function MoveAxesBadge({ frame }: { frame: MoveFrame }) {
  const t = useT();
  const name: Record<Axis, string> = {
    x: t("design.width"),
    y: t("design.height"),
    z: t("design.depth"),
  };
  return (
    <div
      // Desktop: top row, left of 68px lines it up past the add button (12
      // inset + 44 button + 12 gap). Phone/tablet: that row is full (add,
      // Share, menu), so the hint sits in the bottom-left corner instead,
      // opposite the board pad that docks bottom-right there.
      className="pointer-events-none absolute bottom-3 left-3 flex h-8 items-center lg:bottom-auto lg:left-[68px] lg:top-3 lg:h-11"
      style={{ mixBlendMode: "difference" }}
    >
      <span
        className="font-mono text-[11px] font-light uppercase tracking-[0.16em]"
        // Mid grey: far enough from both ends that the difference against a
        // white or a black backdrop still comes out readable, and muted.
        style={{ color: "#8a8a8a" }}
      >
        <span aria-hidden="true" style={{ opacity: 0.7 }}>↔</span> {name[frame.h]}
        <span aria-hidden="true" className="mx-1.5" style={{ opacity: 0.45 }}>·</span>
        <span aria-hidden="true" style={{ opacity: 0.7 }}>↕</span> {name[frame.v]}
      </span>
    </div>
  );
}

function SquareBtn({
  children,
  onClick,
  tone,
  label,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "indigo" | "ghost";
  label: string;
  disabled?: boolean;
}) {
  const cls =
    tone === "indigo"
      ? "bg-indigo-600/90 text-white hover:bg-indigo-600 disabled:bg-zinc-300/90"
      : "bg-white/85 text-zinc-700 ring-1 ring-zinc-200 hover:bg-white";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm backdrop-blur transition disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
}

/** Share, promoted out of the "…" menu and onto the canvas: growing the
 *  community depends on people finding it, and a first-time visitor never
 *  opens a menu to look for it.
 *
 *  Warm oak (#C9A36B, the material palette's Dub) rather than the indigo the
 *  rest of the interface uses. The brand keeps one accent on purpose, so this
 *  is a deliberate exception: two indigo buttons either side of the canvas
 *  would compete, and the warm one reads as an invitation rather than another
 *  control. Ink text on oak keeps the contrast well past AA.
 */
function ShareBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-2xl bg-[#C9A36B] px-4 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-[#BC9155] active:bg-[#AE8548]"
    >
      <ShareIcon />
      {label}
    </button>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.35 10.8 15.7 6.6M8.35 13.2l7.35 4.2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/** The square counterpart to the add button: one control that opens the
 *  clear / share / save actions, so the canvas keeps only two buttons. */
export interface MenuNavAction {
  label: string;
  onClick: () => void;
  disabled: boolean;
}

function ActionMenu({
  label,
  nav,
  items,
  arrange,
}: {
  label: string;
  /** Step back / step forward, shown as one row of arrows above the actions. */
  nav?: { back: MenuNavAction; forward: MenuNavAction };
  items: { key: string; text: string; onClick: () => void }[];
  /** Group operations, below the actions, only while a group is selected. */
  arrange?: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <SquareBtn onClick={() => setOpen((o) => !o)} tone="ghost" label={label}>
        <DotsIcon />
      </SquareBtn>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-13 flex w-56 flex-col overflow-hidden rounded-2xl bg-white/95 py-1 shadow-xl ring-1 ring-zinc-200 backdrop-blur"
        >
          {nav && (
            <div className="mb-1 flex items-center gap-1 border-b border-zinc-100 px-2 pb-1.5 pt-1">
              <NavBtn action={nav.back} />
              <NavBtn action={nav.forward} mirrored />
            </div>
          )}
          {arrange && (
            <div className="order-2 border-t border-zinc-100">{arrange(() => setOpen(false))}</div>
          )}
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              onClick={() => {
                it.onClick();
                setOpen(false);
              }}
              className="order-1 block w-full px-4 py-2.5 text-left text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              {it.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One step-back / step-forward arrow. The same glyph mirrored, so the pair
 *  reads as one control rather than two unrelated icons. */
function NavBtn({ action, mirrored = false }: { action: MenuNavAction; mirrored?: boolean }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.label}
      aria-label={action.label}
      className="flex h-8 flex-1 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
    >
      <UndoIcon mirrored={mirrored} />
    </button>
  );
}

function UndoIcon({ mirrored }: { mirrored?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-[18px] w-[18px] ${mirrored ? "-scale-x-100" : ""}`}
    >
      <path d="M7.5 4.5 3.5 8.5l4 4" />
      <path d="M3.5 8.5h8a5 5 0 0 1 0 10H8" />
    </svg>
  );
}

/** Size box for the selected board: its two face dimensions, labelled by the
 *  axis each one runs along. Thickness is a material choice, not a per-board
 *  one, so it is deliberately absent. */
function BoardSizePanel({
  part,
  design,
  onResize,
  onFill,
  onDone,
}: {
  part: Part;
  design: Design;
  onResize: (field: "aCm" | "bCm", value: number) => void;
  onFill: (field: "aCm" | "bCm") => void;
  onDone: () => void;
}) {
  const t = useT();
  const axes = faceAxes(part);
  const label: Record<Axis, string> = {
    x: t("design.width"),
    y: t("design.height"),
    z: t("design.depth"),
  };
  // The board's own ceiling, not the piece's: on a 5 m run a shelf still stops
  // at one cuttable, shippable board.
  const outerOf = (axis: Axis) =>
    Math.min(design.outerCm[({ x: "w", y: "h", z: "d" } as const)[axis]], MAX_PART_CM);
  const fields: { key: "aCm" | "bCm"; axis: Axis }[] = [
    { key: "aCm", axis: axes.a },
    { key: "bCm", axis: axes.b },
  ];

  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-indigo-300 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-semibold text-zinc-900">{t("design.partSize")}</p>
        <button
          type="button"
          onClick={onDone}
          className="shrink-0 text-sm font-semibold text-indigo-600 transition hover:text-indigo-500"
        >
          {t("design.partDone")}
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {t(`roles.${part.role}`)} · {t("design.partSizeHint")}
      </p>
      <div className="mt-4 space-y-4">
        {fields.map((f) => (
          <SizeControl
            key={f.key}
            label={label[f.axis]}
            value={part[f.key]}
            lim={{ min: MIN_PART_CM, max: outerOf(f.axis) }}
            onChange={(n) => onResize(f.key, n)}
            fillLabel={t("design.partFill")}
            onFill={() => onFill(f.key)}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">{t("design.partThickness", { mm: design.thickness })}</p>
    </div>
  );
}

function SizeControl({
  label,
  value,
  lim,
  onChange,
  fillLabel,
  onFill,
}: {
  label: string;
  value: number;
  lim: { min: number; max: number };
  onChange: (n: number) => void;
  /** When set, shows a small link that jumps the value straight to the
   *  board's standard wall-to-wall span — for a shelf too narrow to know by
   *  eye whether it will actually sit flush once resized. */
  fillLabel?: string;
  onFill?: () => void;
}) {
  const set = (n: number) => onChange(clampN(Math.round(n), lim.min, lim.max));
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        <div className="flex items-center gap-2">
          {onFill && (
            <button
              type="button"
              onClick={onFill}
              className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-500"
            >
              {fillLabel}
            </button>
          )}
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
  canOrder,
  onOrder,
}: {
  quote: ReturnType<typeof quoteDesign>;
  breakdown: ReturnType<typeof breakdownCZK>;
  open: boolean;
  onToggle: () => void;
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
