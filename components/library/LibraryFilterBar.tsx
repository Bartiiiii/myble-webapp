"use client";

import React, { useMemo } from "react";
import posthog from "posthog-js";
import { CategoryPills } from "../CategoryPills";
import type { CategoryId, LibraryItem } from "../../lib/library";
import {
  FILTER_KEYS,
  FILTER_OPTIONS,
  SORTS,
  optionCounts,
  type FilterKey,
  type ItemTags,
  type LibraryFilters,
  type Sort,
} from "../../lib/libraryFilters";
import { useI18n } from "../../lib/i18n";

/**
 * The library's filter bar: the category pills, then one chip per filter
 * (room, width, height, colour, price, assembly) and the sort.
 *
 * Every chip is a native <select> laid invisibly over a pill: keyboard and
 * screen-reader behaviour for free, the phone's own picker on mobile, and no
 * popover layer to fight the cards' stacking. The pill shows the filter's name
 * when unset and the choice when set (turning dark like an active category);
 * it is sized by that text, not by the longest option as a bare select would
 * be. Each option carries the number of designs it would leave, and an option
 * that would leave none is disabled rather than hidden, so the list never
 * changes shape under a finger.
 */
export function LibraryFilterBar({
  pool,
  inCategory,
  tagsOf,
  category,
  onCategory,
  filters,
  onFilters,
  sort,
  onSort,
  resultCount,
}: {
  /** Everything browsable (counts on the pills). */
  pool: LibraryItem[];
  /** The pool narrowed to the active category (counts on the filter options). */
  inCategory: LibraryItem[];
  tagsOf: (item: LibraryItem) => ItemTags;
  category: CategoryId;
  onCategory: (id: CategoryId) => void;
  filters: LibraryFilters;
  onFilters: (filters: LibraryFilters) => void;
  sort: Sort;
  onSort: (sort: Sort) => void;
  resultCount: number;
}) {
  const { t } = useI18n();
  const active = FILTER_KEYS.some((k) => filters[k] !== undefined);

  const counts = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((k) => [k, optionCounts(inCategory, tagsOf, k, filters)])),
    [inCategory, tagsOf, filters],
  ) as Record<FilterKey, Map<string, number>>;

  function set(key: FilterKey, value: string) {
    const next = { ...filters, [key]: value === "" ? undefined : value } as LibraryFilters;
    posthog.capture("library_filter_changed", { filter: key, value: value || "any" });
    onFilters(next);
  }

  return (
    <div>
      <CategoryPills active={category} onSelect={onCategory} pool={pool} />

      <div
        className="-mx-5 mt-3 flex items-center gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={t("library.filters.label")}
      >
        {FILTER_KEYS.map((key) => (
          <Chip
            key={key}
            label={t(`library.filters.${key}.label`)}
            shown={t(filters[key] === undefined ? `library.filters.${key}.label` : `library.filters.${key}.${filters[key]}`)}
            value={filters[key] ?? ""}
            active={filters[key] !== undefined}
            onChange={(v) => set(key, v)}
          >
            <option value="">{t(`library.filters.${key}.label`)}</option>
            {FILTER_OPTIONS[key].map((option) => {
              const n = counts[key].get(option) ?? 0;
              return (
                <option key={option} value={option} disabled={n === 0 && filters[key] !== option}>
                  {`${t(`library.filters.${key}.${option}`)} · ${n}`}
                </option>
              );
            })}
          </Chip>
        ))}

        {active && (
          <button
            type="button"
            onClick={() => {
              posthog.capture("library_filter_changed", { filter: "all", value: "any" });
              onFilters({});
            }}
            className="press shrink-0 px-2 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            {t("library.filters.clear")}
          </button>
        )}

        <div className="ml-auto shrink-0 pl-2">
          <Chip
            label={t("library.filters.sort")}
            shown={t(`library.filters.sorts.${sort}`)}
            value={sort}
            active={false}
            onChange={(v) => {
              posthog.capture("library_sort_changed", { sort: v });
              onSort(v as Sort);
            }}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`library.filters.sorts.${s}`)}
              </option>
            ))}
          </Chip>
        </div>
      </div>

      <p className="mt-2 font-mono text-[11px] text-zinc-400" aria-live="polite">
        {t("library.filters.results", { n: resultCount })}
      </p>
    </div>
  );
}

function Chip({
  label,
  shown,
  value,
  active,
  onChange,
  children,
}: {
  /** The filter's name, read out with the select. */
  label: string;
  /** What the pill says: the current choice, or the filter's name when unset. */
  shown: string;
  value: string;
  active: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full py-2 pl-4 pr-3 text-sm font-medium ring-1 transition focus-within:ring-2 focus-within:ring-indigo-500 ${
        active ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      <span aria-hidden="true">{shown}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className={`pointer-events-none h-3 w-3 ${active ? "text-white/70" : "text-zinc-400"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 4.5l3 3 3-3" />
      </svg>
    </label>
  );
}
