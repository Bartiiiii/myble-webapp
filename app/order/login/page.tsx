"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useT } from "../../../lib/i18n";
import posthog from "posthog-js";

export default function OrderLoginPage() {
  const t = useT();
  const { status } = useSession();
  const callbackUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("callbackUrl") || "/order"
      : "/order";
  const isLoading = status === "loading";
  const isSignedIn = status === "authenticated";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-md px-5 py-16">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M4 10h16M4 15h16" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight">Myble</span>
        </Link>

        <section className="mt-8 rounded-3xl bg-white p-8 ring-1 ring-zinc-200">
          <h1 className="text-2xl font-semibold tracking-tight">{t("login.orderTitle")}</h1>
          <p className="mt-2 text-sm text-zinc-600">{t("login.orderBody")}</p>

          <button
            type="button"
            onClick={() => {
              posthog.capture("order_login_initiated", { provider: "google" });
              signIn("google", { callbackUrl });
            }}
            disabled={isLoading || isSignedIn}
            className="mt-8 inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.58-5.05-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.72A5.41 5.41 0 0 1 3.66 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l2.99-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.56-2.56C13.46.95 11.43 0 9 0A9 9 0 0 0 .96 4.95l2.99 2.33c.71-2.12 2.7-3.7 5.05-3.7z" />
            </svg>
            {isLoading ? t("login.verifying") : isSignedIn ? t("login.already") : t("login.withGoogle")}
          </button>

          {isSignedIn ? (
            <Link
              href={callbackUrl}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              {t("login.continueOrder")}
            </Link>
          ) : null}
        </section>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-600">{t("login.skipTitle")}</p>
          <Link
            href="/order"
            onClick={() => posthog.capture("order_login_skipped")}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            {t("login.asGuest")}
          </Link>
        </div>
      </div>
    </main>
  );
}
