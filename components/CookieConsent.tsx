"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { useConsent, type ConsentState } from "../lib/consent";
import { useI18n } from "../lib/i18n";
import Link from "../lib/localeNav";

// B6: consent banner (opt-in). "Reject all" is as prominent and easy as
// "Accept all". Granular Analytics / Marketing toggles live in the settings
// dialog, which is reachable any time from the footer "Cookie settings" link.
export function CookieConsent() {
  const { decided, settingsOpen } = useConsent();
  const pathname = usePathname();
  // The backstage is a private owner-only tool, not part of the public site.
  if (pathname?.startsWith("/admin")) return null;
  // Show the banner until a decision is made; the settings dialog can be
  // re-opened later from the footer.
  if (decided && !settingsOpen) return null;
  return settingsOpen ? <ConsentSettings /> : <ConsentBanner />;
}

function ConsentBanner() {
  const { acceptAll, rejectAll, openSettings } = useConsent();
  const { t } = useI18n();
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-zinc-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">{t("consent.title")}</p>
            <p className="mt-1 text-sm text-zinc-600">
              {t("consent.body")}{" "}
              <Link href="/legal/cookies-policy" className="font-medium text-indigo-600 underline">
                {t("consent.cookiesLink")}
              </Link>
              .
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={rejectAll}
              className="order-2 inline-flex items-center justify-center rounded-xl bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 sm:order-none"
            >
              {t("consent.rejectAll")}
            </button>
            <button
              type="button"
              onClick={openSettings}
              className="order-3 inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 transition hover:bg-zinc-50 sm:order-none"
            >
              {t("consent.customise")}
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className="order-1 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:order-none"
            >
              {t("consent.acceptAll")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConsentSettings() {
  const { consent, save, acceptAll, rejectAll, closeSettings, decided } = useConsent();
  const { t } = useI18n();
  const [draft, setDraft] = useState<ConsentState>(consent);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-zinc-200">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">{t("consent.settingsTitle")}</h2>
          {decided && (
            <button
              type="button"
              onClick={closeSettings}
              aria-label={t("consent.close")}
              className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-600">{t("consent.settingsBody")}</p>

        <div className="mt-5 space-y-3">
          <CategoryRow
            title={t("consent.essentialTitle")}
            body={t("consent.essentialBody")}
            checked
            disabled
          />
          <CategoryRow
            title={t("consent.analyticsTitle")}
            body={t("consent.analyticsBody")}
            checked={draft.analytics}
            onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
          />
          <CategoryRow
            title={t("consent.marketingTitle")}
            body={t("consent.marketingBody")}
            checked={draft.marketing}
            onChange={(v) => setDraft((d) => ({ ...d, marketing: v }))}
          />
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={rejectAll}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
          >
            {t("consent.rejectAll")}
          </button>
          <button
            type="button"
            onClick={() => save(draft)}
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 transition hover:bg-zinc-50"
          >
            {t("consent.savePrefs")}
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            {t("consent.acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  title,
  body,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  body: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 rounded-2xl p-4 ring-1 ring-zinc-200 ${disabled ? "bg-zinc-50" : "bg-white"}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-900">{title}</span>
        <span className="mt-0.5 block text-xs text-zinc-500">{body}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-zinc-300 accent-indigo-600 disabled:opacity-60"
      />
    </label>
  );
}
