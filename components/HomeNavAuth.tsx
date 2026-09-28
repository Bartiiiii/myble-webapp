"use client";

import { signOut, useSession } from "next-auth/react";
import React from "react";
import { useT } from "../lib/i18n";
import { useLocalizePath } from "../lib/localeNav";

export function HomeNavAuth() {
  const t = useT();
  const lp = useLocalizePath();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  // Signing in must give the page back, not the homepage: somebody half way
  // through a design in the configurator loses it otherwise. Read after mount
  // so the server-rendered link (plain /login) and the first client render
  // agree, then upgrade it to carry the current URL.
  const [loginHref, setLoginHref] = React.useState(() => lp("/login"));

  React.useEffect(() => {
    const here = window.location.pathname + window.location.search;
    setLoginHref(lp(`/login?callbackUrl=${encodeURIComponent(here)}`));
  }, [lp]);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  if (status !== "authenticated") {
    return (
      <a
        href={loginHref}
        className="inline-flex rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      >
        {t("auth.login")}
      </a>
    );
  }

  const user = session?.user;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-900/15 transition hover:ring-zinc-900/25"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={t("auth.account")}
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-zinc-600" fill="currentColor" aria-hidden>
            <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
          </svg>
        )}
      </button>

      {menuOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-zinc-200" role="menu">
          <p className="truncate px-3 py-2 text-xs text-zinc-500" title={user?.email ?? undefined}>
            {user?.email ?? user?.name ?? t("auth.signedIn")}
          </p>
          <a
            href={lp("/account")}
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <circle cx="8" cy="5.5" r="2.5" />
              <path d="M2.5 14c.8-2.8 3-4.3 5.5-4.3s4.7 1.5 5.5 4.3" strokeLinecap="round" />
            </svg>
            {t("auth.myAccount")}
          </a>
          {(session as (typeof session & { isAdmin?: boolean }) | null)?.isAdmin ? (
            <a
              href="/admin"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M2 5.5 8 2l6 3.5v5L8 14l-6-3.5v-5Z" strokeLinejoin="round" />
                <path d="M8 8v6M2 5.5 8 8l6-2.5" strokeLinejoin="round" />
              </svg>
              Backstage
            </a>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
            onClick={() => signOut({ callbackUrl: lp("/") })}
          >
            {t("auth.logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
