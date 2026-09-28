"use client";

import { useLocaleRouter } from "../../lib/localeNav";
import React from "react";
import posthog from "posthog-js";
import { Reveal } from "../Reveal";
import { FireButton } from "../FireButton";
import { AuthorChip } from "./AuthorChip";
import { LazyStage, usePrefersReducedMotion } from "./LazyStage";
import { itemName, type LibraryItem } from "../../lib/library";
import { saveDesign } from "../../lib/design";
import { useI18n } from "../../lib/i18n";
import { useIsNarrow } from "../../lib/useIsNarrow";

/**
 * One design in a grid — used by /library and by a designer's profile.
 *
 * Three interactive things live on top of each other here, so the nesting
 * matters: the 🔥 button and the designer link are SIBLINGS of the card's
 * full-bleed click target, not children of it. A button inside a button is
 * invalid HTML and breaks hydration; z-index does the layering instead.
 */
export function DesignCard({
  item,
  index = 0,
  onDetails,
  showAuthor = true,
  from = "library",
}: {
  item: LibraryItem;
  index?: number;
  onDetails: (item: LibraryItem) => void;
  showAuthor?: boolean;
  from?: string;
}) {
  const { t } = useI18n();
  const router = useLocaleRouter();
  const reduced = usePrefersReducedMotion();
  const narrow = useIsNarrow();
  const name = itemName(item, t);

  return (
    <Reveal delay={(index % 3) * 90}>
      <div className="relative">
        <div className="card-lift relative overflow-hidden rounded-2xl bg-white text-left ring-1 ring-zinc-200 sm:rounded-3xl">
          <div className="relative aspect-square overflow-hidden bg-[#ece7df]">
            <LazyStage design={item.design} reduced={reduced} />
          </div>
          <div className="p-3 sm:p-6">
            <div className="flex items-baseline justify-between gap-2 sm:gap-3">
              <h2 className="truncate text-sm font-semibold text-zinc-900 sm:text-lg">{name}</h2>
              <span className="hidden shrink-0 font-mono text-[11px] text-zinc-400 sm:inline">
                {t(`library.categories.${item.category}`)}
              </span>
            </div>
            {/* Who made it, on the card itself — the library is a library of
                people's designs, and this is the way into their profile. The
                straight-to-editor link keeps its place next to it. */}
            <div className="mt-2 flex items-center justify-between gap-2 sm:mt-3">
              {showAuthor ? (
                <AuthorChip
                  author={item.author}
                  onNavigate={() =>
                    posthog.capture("designer_opened", { handle: item.author.handle, from: `${from}_card` })
                  }
                />
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  posthog.capture("library_design_opened", { id: item.id, from });
                  saveDesign(item.design);
                  router.push("/design");
                }}
                className="press relative z-20 shrink-0 text-[11px] font-semibold text-indigo-600 transition-colors hover:text-indigo-500 sm:text-xs"
              >
                {t("library.openShort")}
              </button>
            </div>
          </div>
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
