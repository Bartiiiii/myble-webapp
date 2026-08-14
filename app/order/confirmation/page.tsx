"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Design, DEFAULT_DESIGN, loadDesign } from "../../../lib/design";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { useI18n } from "../../../lib/i18n";

export default function OrderConfirmationPage() {
  const { t, locale } = useI18n();
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  const [orderNo, setOrderNo] = useState<string>("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesign(loadDesign());
    // Order number comes from the checkout redirect (?order=…); fall back to a
    // generated one if the page is opened directly.
    const fromUrl = new URLSearchParams(window.location.search).get("order");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderNo(fromUrl || `MB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
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
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-zinc-600">
            {t("confirmation.body")}
          </p>

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
