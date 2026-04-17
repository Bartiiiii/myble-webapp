"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import React from "react";

export function HomeNavAuth() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  if (status === "loading") {
    return (
      <div
        className="h-9 w-9 shrink-0 rounded-full bg-zinc-200/80 animate-pulse ring-1 ring-zinc-900/10"
        aria-hidden
      />
    );
  }

  if (status === "unauthenticated") {
    return (
      <Link
        href="/login"
        className="inline-flex rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-900/5"
      >
        Log in
      </Link>
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
        aria-label="Account menu"
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 text-zinc-600"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
          </svg>
        )}
      </button>

      {menuOpen ? (
        <div
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-zinc-200"
          role="menu"
        >
          <p className="truncate px-3 py-2 text-xs text-zinc-500" title={user?.email ?? undefined}>
            {user?.email ?? user?.name ?? "Signed in"}
          </p>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
