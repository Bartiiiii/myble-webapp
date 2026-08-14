"use client";

import Link from "next/link";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { useI18n } from "../../lib/i18n";

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader variant="app" />

      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          ← {t("nav.backHome")}
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{t("about.title")}</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">{t("about.body")}</p>

        <Link
          href="/design"
          className="mt-7 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          {t("about.cta")}
        </Link>
      </div>

      <SiteFooter />
    </main>
  );
}
