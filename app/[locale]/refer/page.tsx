"use client";

import React, { useEffect, useState } from "react";
import posthog from "posthog-js";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { usePromoCopy } from "../../../components/promo/usePromoCopy";
import {
  FaqAccordion,
  LoginCard,
  PanelSkeleton,
  PrimaryButton,
  PromoHero,
  ReferralCard,
  SectionTitle,
  StepRail,
  TermsNote,
  useRewards,
} from "../../../components/promo/ui";
import { PROMO_CODE_STORAGE_KEY, normalizeCode } from "../../../lib/promotions";

// Behind "Give 500 Kč, get 500 Kč" in the promo bar. Two audiences on one URL:
// the customer sharing (their code + link, once logged in) and the friend who
// arrives through that link (?ref=CODE), whose code we keep for checkout.

export default function ReferPage() {
  const c = usePromoCopy();
  const r = c.refer;
  const { state } = useRewards();
  const [arrivedCode, setArrivedCode] = useState<string | null>(null);

  // A friend's link: remember the code so the checkout can fill it in.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("ref");
    const code = raw ? normalizeCode(raw).slice(0, 40) : "";
    if (!code) return;
    try {
      window.localStorage.setItem(PROMO_CODE_STORAGE_KEY, code);
    } catch {
      /* private mode: they can still type it at checkout */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setArrivedCode(code);
    posthog.capture("referral_link_opened", { code });
  }, []);

  const panel =
    state.status === "ready" ? (
      <ReferralCard summary={state.summary} />
    ) : state.status === "anonymous" || state.status === "error" ? (
      <LoginCard title={r.loggedOutTitle} body={r.loggedOutBody} />
    ) : (
      <PanelSkeleton label={r.loading} />
    );

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader variant="app" />

      {arrivedCode && (
        <div className="border-b border-indigo-100 bg-indigo-50">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-base font-semibold text-indigo-950">{r.arrivedTitle}</p>
              <p className="mt-1 text-sm text-indigo-900/80">{r.arrivedBody(arrivedCode)}</p>
            </div>
            <PrimaryButton href="/design">{r.arrivedCta}</PrimaryButton>
          </div>
        </div>
      )}

      <PromoHero eyebrow={r.eyebrow} title={r.title} body={r.body} aside={panel} />

      <div className="mx-auto w-full max-w-6xl px-5">
        <section className="py-16">
          <StepRail steps={r.steps} />
        </section>

        <section className="grid gap-10 border-t border-zinc-200 py-16 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16">
          <SectionTitle>{r.faqTitle}</SectionTitle>
          <FaqAccordion faq={r.faq} track="refer" />
        </section>

        <section className="pb-20">
          <TermsNote text={r.terms} />
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
