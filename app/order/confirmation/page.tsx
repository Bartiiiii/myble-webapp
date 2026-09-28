"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Design, DEFAULT_DESIGN, loadDesign } from "../../../lib/design";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { useI18n } from "../../../lib/i18n";
import { PAYMENTS_ENABLED } from "../../../lib/comgate/config";
import {
  BANK_TRANSFER_ACCOUNT_NUMBER,
  BANK_TRANSFER_DUE_DAYS,
  variableSymbolFromOrderNo,
} from "../../../lib/bankTransfer";

export default function OrderConfirmationPage() {
  const { t, locale } = useI18n();
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  const [orderNo, setOrderNo] = useState<string>("");
  const [totalCzk, setTotalCzk] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesign(loadDesign());
    // Order number comes from the checkout redirect (?order=…); fall back to a
    // generated one if the page is opened directly.
    const fromUrl = new URLSearchParams(window.location.search).get("order");
    const resolvedOrderNo = fromUrl || `MB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderNo(resolvedOrderNo);

    // The total is only known locally if this is the same browser session that
    // just placed THIS order (persisted in app/order/page.tsx's placeOrder()).
    // Guard on orderNo matching: a customer who placed a newer order since, or
    // opened this URL directly/from an old bookmark, must never see a stale or
    // mismatched amount next to a bank-transfer variable symbol — that's a real
    // "customer transfers the wrong amount" risk, not just a display bug.
    try {
      const raw = window.localStorage.getItem("myble.lastOrder");
      if (raw) {
        const parsed = JSON.parse(raw) as { orderNo?: string; totalCzk?: number };
        if (parsed.orderNo === resolvedOrderNo && typeof parsed.totalCzk === "number") {
          setTotalCzk(parsed.totalCzk);
        }
      }
    } catch {
      /* ignore — falls back to the "check your email" copy below */
    }
  }, []);

  const withdrawalDoc = locale === "cs" ? "/legal/withdrawal-form-cz.docx" : "/legal/withdrawal-form-en.docx";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <SiteHeader variant="app" />

      <div className="mx-auto w-full max-w-3xl px-5 py-12">
        <section className="rounded-3xl bg-white p-8 text-center ring-1 ring-zinc-200 sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <p className="mt-6 text-sm font-medium text-emerald-600">
            {t("confirmation.received")}{orderNo ? t("confirmation.no", { n: orderNo }) : ""}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("confirmation.title")}
          </h1>
          {/* While online payment is off the order is real but unpaid — say what
              actually happens next instead of a "we're off to production" state
              that hasn't been earned yet. */}
          {PAYMENTS_ENABLED ? (
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-zinc-600">
              {t("confirmation.body")}
            </p>
          ) : (
            <div className="mx-auto mt-6 max-w-lg rounded-2xl bg-indigo-50/60 p-5 text-left ring-1 ring-indigo-200">
              <p className="text-sm font-semibold text-indigo-900">{t("checkout.paymentsOff.confirmationTitle")}</p>
              <p className="mt-1 text-sm leading-6 text-indigo-800">{t("checkout.paymentsOff.confirmationBody")}</p>
              {orderNo && (
                <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-indigo-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                    {t("checkout.paymentsOff.bankTransferTitle")}
                  </p>
                  {totalCzk != null ? (
                    <dl className="mt-2 space-y-1 text-sm text-indigo-900">
                      <div className="flex justify-between gap-4">
                        <dt className="text-indigo-700">{t("checkout.paymentsOff.bankTransferAccount")}</dt>
                        <dd className="font-semibold tabular-nums">{BANK_TRANSFER_ACCOUNT_NUMBER}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-indigo-700">{t("checkout.paymentsOff.bankTransferVS")}</dt>
                        <dd className="font-semibold tabular-nums">{variableSymbolFromOrderNo(orderNo)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-indigo-700">{t("checkout.paymentsOff.bankTransferAmount")}</dt>
                        <dd className="font-semibold tabular-nums">
                          {totalCzk.toLocaleString(locale === "cs" ? "cs-CZ" : "en-GB")} Kč
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-2 text-sm text-indigo-800">{t("checkout.paymentsOff.bankTransferFallback")}</p>
                  )}
                  <p className="mt-3 text-xs text-indigo-600">
                    {t("checkout.paymentsOff.bankTransferDue", { n: BANK_TRANSFER_DUE_DAYS })}
                  </p>
                  {/* Only when the details are actually on screen — in the
                      fallback state the copy above already points at the e-mail. */}
                  {totalCzk != null && (
                    <p className="mt-1 text-xs text-indigo-500">{t("checkout.paymentsOff.bankTransferEmailNote")}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="rounded-full bg-zinc-50 px-3 py-1 text-zinc-700 ring-1 ring-zinc-200">{t("parts.label")}</span>
            <span className="rounded-full bg-zinc-50 px-3 py-1 text-zinc-700 ring-1 ring-zinc-200">{design.outerCm.w}×{design.outerCm.h}×{design.outerCm.d} cm</span>
            <span className="rounded-full bg-zinc-50 px-3 py-1 text-zinc-700 ring-1 ring-zinc-200">{t("parts.count", { n: design.parts.length })}</span>
            <span className="rounded-full bg-zinc-50 px-3 py-1 text-zinc-700 ring-1 ring-zinc-200">{t(`colors.${design.colour}`)}</span>
          </div>

          <div className="mt-8 rounded-2xl bg-zinc-50 p-5 text-left ring-1 ring-zinc-200">
            <h2 className="text-sm font-semibold">{t("confirmation.whatsNext")}</h2>
            <ol className="mt-4 space-y-3 text-sm text-zinc-600">
              <li className="flex gap-3"><Step n={1} /> {t("confirmation.n1")}</li>
              <li className="flex gap-3"><Step n={2} /> {t("confirmation.n2")}</li>
              <li className="flex gap-3"><Step n={3} /> {t("confirmation.n3")}</li>
              <li className="flex gap-3"><Step n={4} /> {t("confirmation.n4")}</li>
            </ol>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/" className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800">
              {t("confirmation.backHome")}
            </Link>
            <Link href="/design" className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-300 transition hover:bg-zinc-50">
              {t("confirmation.designAnother")}
            </Link>
          </div>
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
            <p className="text-sm font-medium text-indigo-600">{t("confirmation.helpedTitle")}</p>
            <h3 className="mt-1 text-lg font-semibold">{t("confirmation.helpedH")}</h3>
            <p className="mt-2 text-sm text-zinc-600">{t("confirmation.helpedBody")}</p>
          </div>
          <div className="rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
            <p className="text-sm font-medium text-indigo-600">{t("confirmation.changeTitle")}</p>
            <h3 className="mt-1 text-lg font-semibold">{t("confirmation.changeH")}</h3>
            <p className="mt-2 text-sm text-zinc-600">{t("confirmation.changeBody")}</p>
            <a href="mailto:myble.eu@gmail.com" className="mt-3 inline-flex items-center justify-center rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200">
              myble.eu@gmail.com
            </a>
          </div>
        </div>

        {/* B5: order confirmation on a durable medium — the on-screen copy with
            the Terms & Conditions and the model withdrawal form. */}
        <div className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
          <h2 className="text-lg font-semibold">{t("receipt.title")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("receipt.body")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/legal/terms-and-conditions" className="inline-flex items-center rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200">
              {t("receipt.terms")}
            </Link>
            <a href={withdrawalDoc} download className="inline-flex items-center rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200">
              {t("receipt.withdrawal")}
            </a>
            <Link href="/legal/privacy-policy" className="inline-flex items-center rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200">
              {t("receipt.privacy")}
            </Link>
          </div>
          <p className="mt-3 text-xs text-zinc-500">{t("receipt.emailNote")}</p>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
      {n}
    </span>
  );
}
