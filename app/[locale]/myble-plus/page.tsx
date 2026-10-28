"use client";

import React from "react";
import { MybleMark, SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { usePromoCopy } from "../../../components/promo/usePromoCopy";
import {
  FaqAccordion,
  PointsPanel,
  PromoHero,
  SecondaryButton,
  SectionTitle,
  StepRail,
  TermsNote,
  useLoginHref,
  useRewards,
} from "../../../components/promo/ui";

// Behind "myble+ loyalty programme" in the promo bar. Points are earned on
// confirmed orders and for designs accepted into the library, and swapped for
// vouchers here or in the account (lib/rewards.ts enforces all of it).

export default function MyblePlusPage() {
  const c = usePromoCopy();
  const p = c.plus;
  const { state, reload } = useRewards();
  const loginHref = useLoginHref();

  const panel = (
    <MemberCard
      points={state.status === "ready" ? state.summary.points : null}
      loginHref={state.status === "anonymous" || state.status === "error" ? loginHref : null}
    />
  );

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader variant="app" />

      <PromoHero
        eyebrow={p.eyebrow}
        title={<span className="tracking-[-0.04em]">{p.title}</span>}
        titleSub={p.titleSub}
        body={p.body}
        aside={panel}
      />

      <div className="mx-auto w-full max-w-6xl px-5">
        <section className="py-16">
          <StepRail steps={p.steps} />
        </section>

        <section className="border-t border-zinc-200 py-16">
          <SectionTitle>{p.earnTitle}</SectionTitle>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {p.earn.map((e) => (
              <div key={e.t} className="rounded-3xl bg-zinc-50 p-6 ring-1 ring-zinc-200">
                <p className="font-mono text-2xl font-medium tracking-tight text-indigo-600">{e.v}</p>
                <p className="mt-3 text-base font-semibold text-zinc-900">{e.t}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-600">{e.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-zinc-200 py-16">
          <SectionTitle>{p.rewardsTitle}</SectionTitle>
          <div className="mt-8">
            {/* Everyone sees the tiers; a signed-in member also gets the
                redeem buttons. The balance itself is already in the hero. */}
            <PointsPanel summary={state.status === "ready" ? state.summary : null} onRedeemed={reload} showBalance={false} />
          </div>
        </section>

        <section className="grid gap-10 border-t border-zinc-200 py-16 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16">
          <SectionTitle>{p.faqTitle}</SectionTitle>
          <FaqAccordion faq={p.faq} track="myble-plus" />
        </section>

        <section className="mb-12 flex flex-col items-start justify-between gap-5 rounded-3xl bg-zinc-900 p-8 text-white sm:flex-row sm:items-center">
          <div>
            <p className="text-2xl font-semibold tracking-tight">{p.referTitle}</p>
            <p className="mt-1 text-sm text-zinc-400">{p.referBody}</p>
          </div>
          <SecondaryButton href="/refer">{p.referCta}</SecondaryButton>
        </section>

        <section className="pb-20">
          <TermsNote text={p.terms} />
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}

/** The membership card: the balance for a member, the way in for everyone
 *  else. Same shelf-frame mark as the logo, on the dark brand surface. */
function MemberCard({ points, loginHref }: { points: number | null; loginHref: string | null }) {
  const p = usePromoCopy().plus;
  return (
    <div className="relative mx-auto flex aspect-[1.586] w-full max-w-[420px] flex-col justify-between overflow-hidden rounded-[28px] bg-zinc-900 p-6 text-white shadow-[0_30px_60px_-30px_rgba(24,24,27,0.6)] ring-1 ring-white/10">
      {/* Hairline shelf grid, echoing the mark at card scale. */}
      <svg className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 text-white/[0.06]" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="7.5" y="7.5" width="33" height="33" rx="8.5" stroke="currentColor" strokeWidth="0.6" />
        <path d="M27.75 7.5 V40.5 M7.5 28.5 H27.75 M27.75 19.5 H40.5" stroke="currentColor" strokeWidth="0.6" />
      </svg>
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2">
          <MybleMark className="h-6 w-6" accent="#818CF8" />
          <span className="text-lg font-semibold tracking-[-0.03em]">myble+</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{p.eyebrow}</span>
      </div>

      <div className="relative">
        {loginHref ? (
          <>
            <p className="text-base font-semibold tracking-tight">{p.loggedOutTitle}</p>
            <p className="mt-1 max-w-[30ch] text-xs leading-5 text-zinc-400">{p.loggedOutBody}</p>
            <a
              href={loginHref}
              className="press mt-4 inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
            >
              {p.join}
            </a>
          </>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{p.balance}</p>
            <p className="mt-1 font-mono text-4xl font-medium tracking-tight">
              {points == null ? <span className="text-zinc-600">…</span> : p.points(points)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
