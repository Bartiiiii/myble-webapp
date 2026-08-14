"use client";

import Link from "next/link";
import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { useI18n } from "../../../lib/i18n";

// Landing page for the one-click unsubscribe link in newsletter e-mails
// (/api/newsletter/unsubscribe redirects here; ?status=invalid = bad token).

function UnsubscribedBody() {
  const { t } = useI18n();
  const invalid = useSearchParams().get("status") === "invalid";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-5 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        {t(invalid ? "newsletter.unsubErrTitle" : "newsletter.unsubTitle")}
      </h1>
      <p className="mt-4 max-w-xl text-base text-zinc-600">
        {t(invalid ? "newsletter.unsubErrBody" : "newsletter.unsubBody")}
      </p>
      <Link
        href="/"
        className="press mt-9 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
      >
        {t("newsletter.backHome")}
      </Link>
    </main>
  );
}

export default function UnsubscribedPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <Suspense fallback={null}>
        <UnsubscribedBody />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
