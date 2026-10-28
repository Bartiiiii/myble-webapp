"use client";

import React, { useEffect, useState } from "react";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { usePromoCopy } from "../../../components/promo/usePromoCopy";
import { FaqAccordion, PrimaryButton, PromoHero, SecondaryButton, SectionTitle } from "../../../components/promo/ui";
import { loadDesign } from "../../../lib/design";
import { quoteDesign } from "../../../lib/quote";
import { czk } from "../../../lib/promoCopy";
import { FREE_SHIP_CZK } from "../../../lib/promotions";

// Behind the "free delivery" item in the promo bar: what delivery costs, when
// it arrives, who brings it, and what happens if something goes wrong. Every
// fact matches the Terms & Conditions (§5.5, §6, §9.4, §10.2).

export default function DeliveryPage() {
  const c = usePromoCopy();
  const d = c.delivery;

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader variant="app" />

      <PromoHero
        eyebrow={d.eyebrow}
        title={d.title}
        body={d.body}
        aside={
          <dl className="grid grid-cols-2 gap-3">
            {d.stats.map((s, i) => (
              <div key={s.l} className={`rounded-3xl p-5 ${i === 1 ? "bg-zinc-900 text-white" : "bg-white ring-1 ring-zinc-200"}`}>
                <dt className="sr-only">{s.l}</dt>
                <dd>
                  <span className="block font-mono text-2xl font-medium tracking-tight">{s.v}</span>
                  <span className={`mt-2 block text-xs leading-5 ${i === 1 ? "text-zinc-400" : "text-zinc-500"}`}>{s.l}</span>
                </dd>
              </div>
            ))}
          </dl>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-5">
        <FreeShipProgress />

        <section className="grid gap-10 py-16 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16">
          <div>
            <SectionTitle>{d.faqTitle}</SectionTitle>
          </div>
          <FaqAccordion faq={d.faq} track="delivery" />
        </section>

        <section className="mb-20 flex flex-col items-start justify-between gap-5 rounded-3xl bg-zinc-50 p-8 ring-1 ring-zinc-200 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-semibold tracking-tight">{d.helpTitle}</p>
            <p className="mt-1 text-sm text-zinc-600">{d.helpBody}</p>
          </div>
          <SecondaryButton href="/contact">{d.helpCta}</SecondaryButton>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}

/** How far the visitor's own saved design is from free delivery. Reads the
 *  configurator's local draft, so it only ever talks about their piece. */
function FreeShipProgress() {
  const c = usePromoCopy();
  const d = c.delivery;
  const [kit, setKit] = useState<number | null>(null);

  useEffect(() => {
    let price = 0;
    try {
      if (window.localStorage.getItem("myble.design.v3")) price = quoteDesign(loadDesign()).price;
    } catch {
      /* no draft */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKit(price);
  }, []);

  if (kit === null) return <div className="h-[132px]" aria-hidden="true" />;

  const has = kit > 0;
  const gap = Math.max(0, FREE_SHIP_CZK - kit);
  const pct = has ? Math.min(100, (kit / FREE_SHIP_CZK) * 100) : 0;

  return (
    <section className="-mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{d.progressTitle}</p>
          <p className="mt-1.5 text-base font-medium text-zinc-900">
            {!has ? d.progressEmpty : gap > 0 ? d.progressRemaining(czk(gap)) : d.progressDone}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 font-mono text-xs text-zinc-500">
              {has ? czk(kit) : "0 Kč"} / {czk(FREE_SHIP_CZK)}
            </span>
          </div>
        </div>
        <PrimaryButton href="/design">{has ? d.progressCta : d.progressEmptyCta}</PrimaryButton>
      </div>
    </section>
  );
}
