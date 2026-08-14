"use client";

import React from "react";
import { LOCALES, useI18n } from "../lib/i18n";

// Footer language picker: click the current flag to open a dropdown of choices.
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const current = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

  return (
    <div className="inline-flex items-center gap-2" ref={wrapRef}>
      <span className="text-xs text-zinc-500">{t("home.language")}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-300 transition hover:bg-zinc-50"
        >
          <span aria-hidden className="text-sm leading-none">{current.flag}</span>
          <span>{current.short}</span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
            className={`h-3 w-3 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.084l3.71-3.854a.75.75 0 1 1 1.08 1.04l-4.24 4.41a.75.75 0 0 1-1.08 0l-4.24-4.41a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
          </svg>
        </button>

        <div
          role="listbox"
          className={`absolute bottom-full right-0 z-50 mb-2 w-32 origin-bottom-right overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-zinc-200 transition duration-150 ease-out ${
            open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-1 scale-95 opacity-0"
          }`}
        >
          {LOCALES.map((l) => {
            const active = l.id === locale;
            return (
              <button
                key={l.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setLocale(l.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span aria-hidden className="text-sm leading-none">{l.flag}</span>
                <span>{l.short}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
