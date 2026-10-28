"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import Link, { useLocalizePath } from "../../lib/localeNav";
import { useI18n } from "../../lib/i18n";
import type { Faq } from "../../lib/promoCopy";
import { czk } from "../../lib/promoCopy";
import { LOYALTY_REWARDS, minKitFor } from "../../lib/promotions";
import type { RewardsSummary } from "../../lib/rewards";
import { usePromoCopy } from "./usePromoCopy";

// Building blocks shared by the promo pages (/delivery, /refer, /myble-plus)
// and the account Rewards tab. Same visual language as the rest of the site:
// zinc surfaces, one indigo accent, every number in Geist Mono.

// ── Layout ───────────────────────────────────────────────────────────────────

export function PromoHero({
  eyebrow,
  title,
  titleSub,
  body,
  children,
  aside,
}: {
  eyebrow: string;
  title: React.ReactNode;
  titleSub?: string;
  body: string;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="border-b border-zinc-200 bg-zinc-50">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-14">
        <div>
          <p className="text-sm font-semibold text-indigo-600">{eyebrow}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-5xl">{title}</h1>
          {titleSub && <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-400 sm:text-3xl">{titleSub}</p>}
          <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">{body}</p>
          {children && <div className="mt-7 flex flex-wrap gap-3">{children}</div>}
        </div>
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
    </section>
  );
}

export function PrimaryButton({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="press inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}

export function SecondaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="press inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-300 transition hover:bg-zinc-50"
    >
      {children}
    </Link>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{children}</h2>;
}

/** The three-step rail: hairline-topped columns with mono step numbers. */
export function StepRail({ steps }: { steps: readonly { n: string; t: string; d: string }[] }) {
  return (
    <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
      {steps.map((s) => (
        <li key={s.n} className="border-t-2 border-zinc-900 pt-5">
          <p className="font-mono text-xs font-medium tracking-wide text-indigo-600">{s.n}</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-900">{s.t}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{s.d}</p>
        </li>
      ))}
    </ol>
  );
}

/** Same t-acc accordion as the homepage FAQ, with an optional link per answer. */
export function FaqAccordion({ faq, track }: { faq: readonly Faq[]; track: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-zinc-200 border-y border-zinc-200">
      {faq.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="t-acc" data-open={isOpen}>
            <button
              type="button"
              className="t-acc-head flex w-full items-center justify-between gap-6 px-1 py-5 text-left"
              onClick={() => {
                setOpen(isOpen ? null : i);
                if (!isOpen) posthog.capture("promo_faq_opened", { page: track, question: it.q });
              }}
              aria-expanded={isOpen}
            >
              <span className="text-base font-medium text-zinc-900">{it.q}</span>
              <span className="t-acc-chevron flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6.5L8 10.5L12 6.5" />
                </svg>
              </span>
            </button>
            <div className="t-acc-panel">
              <div className="t-acc-panel-inner">
                <div className="max-w-2xl px-1 pb-5">
                  <p className="text-sm leading-6 text-zinc-600">{it.a}</p>
                  {it.link && (
                    <Link href={it.link.href} className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500">
                      {it.link.label} →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TermsNote({ text }: { text: string }) {
  return <p className="max-w-3xl text-xs leading-5 text-zinc-500">{text}</p>;
}

// ── Session + rewards data ───────────────────────────────────────────────────

/** Login link that brings the visitor back to this page afterwards. */
export function useLoginHref(): string {
  const lp = useLocalizePath();
  const [href, setHref] = useState(() => lp("/login"));
  useEffect(() => {
    const here = window.location.pathname + window.location.search;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHref(lp(`/login?callbackUrl=${encodeURIComponent(here)}`));
  }, [lp]);
  return href;
}

export type RewardsState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "error" }
  | { status: "ready"; summary: RewardsSummary };

/** The signed-in customer's rewards, or "anonymous" when nobody is logged in. */
export function useRewards(): { state: RewardsState; reload: () => void } {
  const { status } = useSession();
  const [state, setState] = useState<RewardsState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "anonymous" });
      return;
    }
    let cancelled = false;
    fetch("/api/rewards")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setState(j?.ok ? { status: "ready", summary: j.summary } : { status: "error" });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [status, tick]);

  return { state, reload };
}

// ── Referral code card ───────────────────────────────────────────────────────

export function referralLink(code: string, locale: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://my-ble.eu";
  return `${origin}/${locale === "cs" ? "cz" : "en"}/refer?ref=${encodeURIComponent(code)}`;
}

export function ReferralCard({ summary, dark = true }: { summary: RewardsSummary; dark?: boolean }) {
  const c = usePromoCopy();
  const { locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const link = referralLink(summary.referralCode, locale);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      posthog.capture("referral_link_copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the link is still visible to copy by hand */
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Myble", text: c.refer.shareText, url: link });
      posthog.capture("referral_link_shared");
    } catch {
      /* dismissed */
    }
  }

  const surface = dark ? "bg-zinc-900 text-white" : "bg-white text-zinc-900 ring-1 ring-zinc-200";
  const muted = dark ? "text-zinc-400" : "text-zinc-500";

  return (
    <div className={`rounded-3xl p-6 ${surface}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{c.refer.yourCode}</p>
      <p className="mt-2 break-all font-mono text-3xl font-medium tracking-[0.08em]">{summary.referralCode}</p>
      <p className={`mt-2 truncate font-mono text-xs ${muted}`}>{link.replace(/^https?:\/\//, "")}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className={`press inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            dark ? "bg-white text-zinc-900 hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-800"
          }`}
        >
          {copied ? c.refer.copied : c.refer.copyLink}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={share}
            className={`press inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition ${
              dark ? "text-white ring-zinc-700 hover:bg-zinc-800" : "text-zinc-900 ring-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {c.refer.share}
          </button>
        )}
      </div>
      <dl className={`mt-6 grid grid-cols-2 gap-4 border-t pt-5 ${dark ? "border-zinc-800" : "border-zinc-100"}`}>
        <div>
          <dt className={`text-xs ${muted}`}>{c.refer.statsConfirmed}</dt>
          <dd className="mt-1 font-mono text-xl">{summary.referralsConfirmed}</dd>
        </div>
        <div>
          <dt className={`text-xs ${muted}`}>{c.refer.statsPending}</dt>
          <dd className="mt-1 font-mono text-xl">{summary.referralsPending}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Logged-out stand-in for a personal panel. */
export function LoginCard({ title, body }: { title: string; body: string }) {
  const c = usePromoCopy();
  const loginHref = useLoginHref();
  return (
    <div className="rounded-3xl bg-zinc-900 p-6 text-white">
      <p className="text-lg font-semibold tracking-tight">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
      <a
        href={loginHref}
        className="press mt-5 inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
      >
        {c.refer.login}
      </a>
    </div>
  );
}

export function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-3xl bg-zinc-900 p-6 text-sm text-zinc-500">{label}</div>
  );
}

// ── myble+ points ────────────────────────────────────────────────────────────

/** Balance, progress to the next tier, and the redeem tiers. */
export function PointsPanel({
  summary,
  onRedeemed,
  showBalance = true,
}: {
  summary: RewardsSummary | null;
  onRedeemed?: () => void;
  showBalance?: boolean;
}) {
  const c = usePromoCopy();
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const balance = summary?.points ?? 0;
  const next = LOYALTY_REWARDS.find((r) => r.points > balance);

  async function redeem(tier: number) {
    setBusy(tier);
    setMessage(null);
    try {
      const res = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMessage(c.plus.redeemed(j.code));
        posthog.capture("loyalty_points_redeemed", { tier, czk: LOYALTY_REWARDS[tier].czk });
        onRedeemed?.();
      } else {
        setMessage(c.plus.redeemFailed);
      }
    } catch {
      setMessage(c.plus.redeemFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {summary && showBalance && (
        <div className="rounded-3xl bg-zinc-900 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{c.plus.balance}</p>
          <p className="mt-2 font-mono text-4xl font-medium tracking-tight">{c.plus.points(balance)}</p>
          {next ? (
            <>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.min(100, (balance / next.points) * 100)}%` }} />
              </div>
              <p className="mt-3 text-sm text-zinc-400">{c.plus.nextReward(next.points - balance, czk(next.czk))}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">{c.plus.allUnlocked}</p>
          )}
        </div>
      )}

      <ul className={`grid gap-3 sm:grid-cols-3 ${summary && showBalance ? "mt-4" : ""}`}>
        {LOYALTY_REWARDS.map((r, i) => {
          const affordable = summary != null && balance >= r.points;
          return (
            <li key={r.points} className="flex flex-col rounded-3xl bg-white p-5 ring-1 ring-zinc-200">
              <p className="font-mono text-3xl font-medium tracking-tight text-zinc-900">{czk(r.czk)}</p>
              <p className="mt-1 font-mono text-sm text-indigo-600">{c.plus.rewardPoints(r.points)}</p>
              <p className="mt-1 text-xs text-zinc-500">{c.plus.rewardMin(minKitFor(r.czk))}</p>
              {summary && (
                <button
                  type="button"
                  disabled={!affordable || busy !== null}
                  onClick={() => redeem(i)}
                  className="press mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  {busy === i ? c.plus.redeeming : affordable ? c.plus.redeem : c.plus.needMore(r.points - balance)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {message && (
        <p role="status" className="mt-3 rounded-2xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900 ring-1 ring-indigo-100">
          {message}
        </p>
      )}
    </div>
  );
}
