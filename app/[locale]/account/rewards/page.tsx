"use client";

import React, { useState } from "react";
import Link from "../../../../lib/localeNav";
import { useI18n } from "../../../../lib/i18n";
import { czk } from "../../../../lib/promoCopy";
import type { VoucherRow } from "../../../../lib/rewards";
import { EmptyState, Section } from "../../../../components/account/ui";
import { usePromoCopy } from "../../../../components/promo/usePromoCopy";
import { PointsPanel, ReferralCard, useRewards } from "../../../../components/promo/ui";

// Account → Rewards: the customer's referral code, myble+ balance (with the
// redeem tiers), their vouchers and the points history. All of it comes from
// /api/rewards, scoped to the session e-mail.

export default function AccountRewards() {
  const c = usePromoCopy();
  const a = c.account;
  const { state, reload } = useRewards();

  if (state.status !== "ready") {
    return (
      <div className="space-y-6">
        <Header />
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-50 ring-1 ring-zinc-200" />
      </div>
    );
  }
  const s = state.summary;

  return (
    <div className="space-y-6">
      <Header />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Section title={a.referTitle} action={<Link href="/refer" className="text-sm font-semibold text-indigo-600">{a.learnMore}</Link>}>
          <p className="mb-4 text-sm text-zinc-600">{a.referBody}</p>
          <ReferralCard summary={s} />
        </Section>

        <Section title={a.plusTitle} action={<Link href="/myble-plus" className="text-sm font-semibold text-indigo-600">{a.learnMore}</Link>}>
          <PointsPanel summary={s} onRedeemed={reload} />
        </Section>
      </div>

      <Section title={a.vouchersTitle}>
        {s.vouchers.length === 0 ? (
          <EmptyState text={a.vouchersEmpty} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {s.vouchers.map((v) => (
              <VoucherItem key={v.code} v={v} />
            ))}
          </ul>
        )}
      </Section>

      <Section title={a.historyTitle}>
        {s.ledger.length === 0 ? (
          <EmptyState text={a.historyEmpty} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {s.ledger.map((e) => (
              <li key={`${e.reason}-${e.ref}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-zinc-700">{(a.reasons[e.reason] ?? ((r: string) => r))(e.ref)}</span>
                <span className={`font-mono ${e.points >= 0 ? "text-emerald-700" : "text-zinc-500"}`}>
                  {e.points >= 0 ? "+" : ""}
                  {e.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Header() {
  const a = usePromoCopy().account;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{a.title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{a.intro}</p>
    </div>
  );
}

function VoucherItem({ v }: { v: VoucherRow }) {
  const a = usePromoCopy().account;
  const { locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => Date.now());
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  const expired = !v.redeemed_order_no && v.expires_at != null && new Date(v.expires_at).getTime() < now;
  const live = !v.redeemed_order_no && !expired;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0">
        <p className={`font-mono text-base tracking-[0.06em] ${live ? "text-zinc-900" : "text-zinc-400 line-through"}`}>{v.code}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {v.source === "referral_reward" ? a.sourceReferral : a.sourceLoyalty} · {a.voucherFrom(czk(v.min_kit_czk))} ·{" "}
          {v.redeemed_order_no ? a.voucherUsed(v.redeemed_order_no) : expired ? a.voucherExpired : v.expires_at ? a.voucherExpires(date(v.expires_at)) : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-lg font-medium text-zinc-900">{czk(v.amount_czk)}</span>
        {live && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(v.code);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              } catch {
                /* the code is on screen */
              }
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
          >
            {copied ? "✓" : a.copyCode}
          </button>
        )}
      </div>
    </li>
  );
}
