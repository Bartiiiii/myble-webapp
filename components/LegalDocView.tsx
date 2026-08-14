"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { useI18n } from "../lib/i18n";
import { type LegalSlug } from "../lib/legal";

// Renders one legal document. The server passes the verbatim markdown for BOTH
// locales; we pick the one matching the current locale from context, so the
// footer language switcher updates the document live (the app has no per-locale
// URL routing — see lib/i18n.tsx).
export function LegalDocView({
  slug,
  en,
  cs,
}: {
  slug: LegalSlug;
  en: string;
  cs: string;
}) {
  const { locale, t } = useI18n();
  const markdown = locale === "cs" ? cs : en;

  const isWithdrawal = slug === "withdrawal-form";
  const isComplaints = slug === "complaints-procedure";
  const docFile = locale === "cs" ? "/legal/withdrawal-form-cz.docx" : "/legal/withdrawal-form-en.docx";

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader variant="app" />

      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
        <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          ← {t("nav.backHome")}
        </Link>

        {/* Action bar for documents that need one (B: downloadable withdrawal
            form; B10: complaint intake). */}
        {(isWithdrawal || isComplaints) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {isWithdrawal && (
              <a
                href={docFile}
                download
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                {t("legal.downloadWithdrawal")}
              </a>
            )}
            {isWithdrawal && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-300 transition hover:bg-zinc-50 print:hidden"
              >
                {t("legal.print")}
              </button>
            )}
            {isComplaints && (
              <a
                href={`mailto:myble.eu@gmail.com?subject=${encodeURIComponent(t("legal.complaintSubject"))}&body=${encodeURIComponent(t("legal.complaintBody"))}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                {t("legal.fileComplaint")}
              </a>
            )}
          </div>
        )}

        <article className="legal-prose mt-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      </div>

      <SiteFooter />
    </main>
  );
}
