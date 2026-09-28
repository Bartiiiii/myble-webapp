"use client";

// Design library — curated pieces plus the community designs backstage has
// approved. Every card is a real, orderable Design: opening one writes it to
// the configurator's storage and goes to /design, so inspiration is one click
// from editing. Tapping a card opens the detail dialog; tapping the designer
// goes to their profile.

import Link from "../../../lib/localeNav";
import React, { useMemo, useState } from "react";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { Reveal } from "../../../components/Reveal";
import { CategoryPills } from "../../../components/CategoryPills";
import { DesignCard } from "../../../components/library/DesignCard";
import { DesignDialog } from "../../../components/library/DesignDialog";
import { sortedByHeat, type CategoryId, type LibraryItem } from "../../../lib/library";
import { ReactionsProvider, useReactions } from "../../../lib/reactions";
import { useLibraryPool } from "../../../lib/useLibraryPool";
import { useI18n } from "../../../lib/i18n";
import posthog from "posthog-js";

function LibraryBody() {
  const { t } = useI18n();
  const { counts } = useReactions();
  const { pool } = useLibraryPool();
  const [category, setCategory] = useState<CategoryId>("all");
  const [detail, setDetail] = useState<LibraryItem | null>(null);

  // Hottest first; ties fall back to the pool order, so the grid is stable
  // before anyone has reacted.
  const items = useMemo(() => sortedByHeat(counts, category, pool), [counts, category, pool]);

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
          <CategoryPills active={category} onSelect={setCategory} pool={pool} />
        </Reveal>
      </section>

      {/* Grid */}
      <section className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {items.map((item, i) => (
            <DesignCard key={item.id} item={item} index={i} onDetails={setDetail} from="library" />
          ))}
        </div>
      </section>

      <DesignDialog item={detail} onClose={() => setDetail(null)} from="library" />
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
