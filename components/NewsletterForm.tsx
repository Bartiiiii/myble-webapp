"use client";

import Link from "next/link";
import React, { useState } from "react";
import posthog from "posthog-js";
import { useI18n } from "../lib/i18n";

// Shared newsletter capture card (footer + homepage) → /api/newsletter →
// `newsletter_subscribers` + Resend contact + welcome e-mail. `source` tags
// where the signup happened, both in the DB row and the PostHog event.
export function NewsletterForm({ source, className = "" }: { source: "footer" | "homepage"; className?: string }) {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, source }),
      });
      setState(res.ok ? "ok" : "error");
      if (res.ok) {
        setEmail("");
        posthog.capture("newsletter_signup_submitted", { source, locale });
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div className={`rounded-3xl bg-white p-6 ring-1 ring-zinc-200 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{t("footer.newsTitle")}</p>
          <p className="mt-1 text-sm text-zinc-600">{t("footer.newsBody")}</p>
        </div>
        <form onSubmit={subscribe} className="flex w-full max-w-md gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("footer.newsPlaceholder")}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={state === "loading"}
            className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-400"
          >
            {t("footer.newsCta")}
          </button>
        </form>
      </div>
      {state === "ok" && <p className="mt-3 text-sm font-medium text-emerald-600">{t("footer.newsOk")}</p>}
      {state === "error" && <p className="mt-3 text-sm font-medium text-rose-600">{t("footer.newsErr")}</p>}
      <p className="mt-3 text-xs text-zinc-500">
        {t("footer.newsConsent")}{" "}
        <Link href="/legal/privacy-policy" className="underline hover:text-zinc-700">
          {t("legal.docs.privacy-policy.title")}
        </Link>
      </p>
    </div>
  );
}
