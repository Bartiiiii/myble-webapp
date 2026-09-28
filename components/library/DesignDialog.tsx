"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import posthog from "posthog-js";
import { FireButton } from "../FireButton";
import { AuthorChip } from "./AuthorChip";
import { usePrefersReducedMotion, WALL } from "./LazyStage";
import { itemName, itemNote, type LibraryItem } from "../../lib/library";
import { saveDesign } from "../../lib/design";
import { useI18n } from "../../lib/i18n";

const ShelfViewer = dynamic(() => import("../ShelfViewer"), { ssr: false });

/**
 * Detail dialog for one design: the piece up close, its story, who built it,
 * and the way into the configurator.
 *
 * Shared by /library and the homepage highlights — the homepage used to link
 * straight to /library, which made "see this piece" cost a page load. Both now
 * open the same dialog over the page they are already on.
 *
 * Always rendered by the PAGE, never by a card: cards sit inside <Reveal>,
 * whose transform would make `position: fixed` resolve against the card
 * instead of the viewport.
 */
export function DesignDialog({
  item,
  onClose,
  from = "library",
}: {
  item: LibraryItem | null;
  onClose: () => void;
  from?: string;
}) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const router = useRouter();

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

  const name = itemName(item, t);
  const note = itemNote(item, t);
  const { w, h, d } = item.design.outerCm;

  function openInConfigurator() {
    if (!item) return;
    posthog.capture("library_design_opened", { id: item.id, from: `${from}_dialog` });
    saveDesign(item.design);
    router.push("/design");
  }

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

            {/* Designed by — a real link to a real profile, right under the
                title rather than buried in the spec list, which is where it
                used to sit as an unclickable line of text. */}
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-3 py-2.5">
              <AuthorChip author={item.author} size="md" strong onNavigate={onClose} />
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-zinc-400">
                {t("library.byLabel")}
              </span>
            </div>

            {note && <p className="mt-3 text-sm leading-6 text-zinc-600">{note}</p>}

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
            </dl>

            <button
              type="button"
              onClick={openInConfigurator}
              className="press mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 sm:w-auto"
            >
              {t("library.open")}
            </button>
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
