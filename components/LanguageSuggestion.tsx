"use client";

import React from "react";
import { rememberLocale, useI18n } from "../lib/i18n";
import { LOCALE_COOKIE, localeFromLanguages, type Locale } from "../lib/locale";

// Someone whose browser speaks the other language landed on a /cz or /en URL
// directly (a shared link, an old bookmark). Prefixed URLs are never
// auto-redirected, so offer the switch instead, worded in their language.
// Shown only until the visitor makes any choice, which is remembered.
const COPY: Record<Locale, { text: string; action: string; close: string }> = {
  cs: { text: "Tato stránka je dostupná i v češtině.", action: "Přepnout do češtiny", close: "Zavřít" },
  en: { text: "This page is also available in English.", action: "Switch to English", close: "Close" },
};

function hasChosen(): boolean {
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
}

export function LanguageSuggestion() {
  const { locale, setLocale } = useI18n();
  const [suggested, setSuggested] = React.useState<Locale | null>(null);

  React.useEffect(() => {
    if (hasChosen()) return;
    const preferred = localeFromLanguages(navigator.languages?.length ? navigator.languages : [navigator.language]);
    if (preferred !== locale) setSuggested(preferred);
  }, [locale]);

  if (!suggested || suggested === locale) return null;
  const copy = COPY[suggested];

  return (
    <div role="region" aria-label={copy.text} className="bg-zinc-900 text-zinc-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-2 text-sm">
        <p>{copy.text}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLocale(suggested)}
            className="rounded-lg bg-indigo-500 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-400"
          >
            {copy.action}
          </button>
          <button
            type="button"
            aria-label={copy.close}
            onClick={() => {
              rememberLocale(locale);
              setSuggested(null);
            }}
            className="rounded-lg px-2 py-1 text-zinc-400 hover:text-zinc-50"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
