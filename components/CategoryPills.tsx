"use client";

import React from "react";
import { CATEGORIES, categoryCount, type CategoryId } from "../lib/library";
import { useT } from "../lib/i18n";

/**
 * Browse-by-category pills. These carry more weight than they look: seeing
 * "Music & TV · Office · Pets" in one glance communicates the breadth of the
 * library faster than any number of extra cards would.
 *
 * Horizontally scrollable on narrow screens rather than wrapping, so the row
 * stays one clean line and hints there is more to the right.
 */
export function CategoryPills({
  active,
  onSelect,
  showCounts = true,
}: {
  active: CategoryId;
  onSelect: (id: CategoryId) => void;
  showCounts?: boolean;
}) {
  const t = useT();

  return (
    <div
      className="-mx-5 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label={t("library.categories.all")}
    >
      {CATEGORIES.map((c) => {
        const isActive = c.id === active;
        const n = categoryCount(c.id);
        if (n === 0) return null;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-pressed={isActive}
            className={`press inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${
              isActive
                ? "bg-zinc-900 text-white ring-zinc-900"
                : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <span aria-hidden="true" className={isActive ? "text-white/70" : "text-zinc-400"}>
              {c.emoji}
            </span>
            {t(`library.categories.${c.id}`)}
            {showCounts && (
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  isActive ? "text-white/60" : "text-zinc-400"
                }`}
              >
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
