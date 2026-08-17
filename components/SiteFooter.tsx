"use client";

import Link from "next/link";
import React from "react";
import { Logo } from "./SiteHeader";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NewsletterForm } from "./NewsletterForm";
import { useI18n } from "../lib/i18n";
import { useConsent } from "../lib/consent";
import { LEGAL_SLUGS } from "../lib/legal";

// Shared global footer. Carries the localized Legal group (Part A), links to
// the Contact and About pages, a persistent "Cookie settings" control (B6),
// the newsletter capture, and the language switcher. Seller identification /
// imprint (B9) lives on the Contact page (/contact) — see app/contact/page.tsx.
// `newsletter={false}` skips the capture card for pages that render their own
// (the homepage has a dedicated section right above the footer).
export function SiteFooter({ newsletter = true }: { newsletter?: boolean }) {
  const { t } = useI18n();
  const { openSettings } = useConsent();

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 print:hidden">
      <div className="mx-auto w-full max-w-6xl px-5 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <Logo />
            <p className="mt-3 text-sm text-zinc-600">{t("home.footerTagline")}</p>
            <p className="mt-4 text-xs text-zinc-500">© {new Date().getFullYear()} Myble</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-900">{t("home.footerProduct")}</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li><Link className="hover:text-zinc-900" href="/design">{t("home.footerConfigurator")}</Link></li>
              <li><Link className="hover:text-zinc-900" href="/library">{t("home.footerLibrary")}</Link></li>
              <li><Link className="hover:text-zinc-900" href="/#nabidka">{t("home.footerOffer")}</Link></li>
              <li><Link className="hover:text-zinc-900" href="/design">{t("home.footerPrice")}</Link></li>
            </ul>
          </div>

          {/* Legal / Právní — B: all six documents, localized. */}
          <div>
            <p className="text-sm font-semibold text-zinc-900">{t("footer.legal")}</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              {LEGAL_SLUGS.map((slug) => (
                <li key={slug}>
                  <Link className="hover:text-zinc-900" href={`/legal/${slug}`}>
                    {t(`legal.docs.${slug}.title`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-900">{t("home.footerContact")}</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li><Link className="hover:text-zinc-900" href="/contact">{t("footer.contactLink")}</Link></li>
              <li><Link className="hover:text-zinc-900" href="/about">{t("footer.aboutLink")}</Link></li>
              <li>
                <button type="button" onClick={openSettings} className="text-left hover:text-zinc-900">
                  {t("footer.cookieSettings")}
                </button>
              </li>
            </ul>
          </div>
        </div>

        {newsletter && <NewsletterForm source="footer" className="mt-10" />}

        {/* Seller identification on every page. Comgate's merchant review looks
            for company registration details site-wide, not only on /contact. */}
        <div className="mt-10 border-t border-zinc-200 pt-6">
          <p className="text-xs leading-5 text-zinc-500">
            <span className="font-medium text-zinc-700">{t("imprint.name")}</span>
            {" · "}{t("imprint.ico")}
            {" · "}{t("imprint.address")}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {t("imprint.tradeRegister")} {t("imprint.notVatPayer")}{" "}
            <a href="mailto:myble.eu@gmail.com" className="hover:text-zinc-900">{t("imprint.email")}</a>
          </p>
        </div>

        <div className="mt-6 border-t border-zinc-200 pt-6">
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
