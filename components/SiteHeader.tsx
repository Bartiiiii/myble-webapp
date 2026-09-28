"use client";

import Link, { useLocalePathname } from "../lib/localeNav";
import React from "react";
import { HomeNavAuth } from "./HomeNavAuth";
import { useT } from "../lib/i18n";

// The single global header shared across home → configurator → order, so the
// whole app feels continuous.

/**
 * Myble mark — "The Exact Fit": a shelving frame with offset shelves and the
 * made-to-measure accent block fitted into its gap. Source of truth:
 * public/brand/myble-mark.svg + brand/brand-guidelines.md §2.
 */
export function MybleMark({ className = "h-7 w-7", accent = "#4F46E5" }: { className?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect x="7.5" y="7.5" width="33" height="33" rx="8.5" stroke="currentColor" strokeWidth="3.75" />
      <path d="M27.75 7.5 V40.5" stroke="currentColor" strokeWidth="3.75" />
      <path d="M7.5 28.5 H27.75" stroke="currentColor" strokeWidth="3.75" />
      <path d="M27.75 19.5 H40.5" stroke="currentColor" strokeWidth="3.75" />
      <rect x="30.4" y="10.15" width="7.45" height="6.6" rx="2" fill={accent} />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  const pathname = useLocalePathname();

  return (
    <Link
      href="/"
      className="flex items-center gap-2"
      onClick={(e) => {
        if (pathname === "/") {
          e.preventDefault();
          window.location.reload();
        }
      }}
    >
      <span className={dark ? "text-zinc-50" : "text-zinc-900"}>
        <MybleMark accent={dark ? "#818CF8" : "#4F46E5"} />
      </span>
      <span className={`text-[17px] font-semibold tracking-[-0.02em] ${dark ? "text-zinc-50" : "text-zinc-900"}`}>
        myble
      </span>
    </Link>
  );
}

/**
 * `variant`:
 *  - "marketing" (default) — homepage: section nav + "Navrhnout svůj kus" CTA.
 *  - "app" — configurator / order: same logo in the same place, but the homepage
 *    section links are dropped (they only point at homepage sections) and a
 *    "back to home" button is shown instead.
 */
export function SiteHeader({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const t = useT();
  const isApp = variant === "app";

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
        <Logo />
        <div className="flex items-center gap-2">
          {isApp && (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l9-8 9 8M5 9.5V20h14V9.5" />
              </svg>
              <span className="hidden sm:inline">{t("nav.backHome")}</span>
            </Link>
          )}
          <HomeNavAuth />
        </div>
      </div>
    </header>
  );
}
