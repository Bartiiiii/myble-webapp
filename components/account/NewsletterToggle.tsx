"use client";

import React from "react";
import { useI18n } from "../../lib/i18n";

// Self-contained: fetches its own initial state on mount rather than the
// server component passing it down, since the state can change from other
// tabs/devices (e.g. unsubscribing via the e-mail link) and this is the one
// genuinely mutable setting on the page.
export function NewsletterToggle() {
  const { t, locale } = useI18n();
  const [subscribed, setSubscribed] = React.useState<boolean | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/account/newsletter")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body?.ok) setSubscribed(!!body.subscribed);
      })
      .catch(() => {
        if (!cancelled) setSubscribed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (subscribed === null || pending) return;
    const next = !subscribed;
    setPending(true);
    setSubscribed(next); // optimistic
    try {
      const res = await fetch("/api/account/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribed: next, locale }),
      });
      if (!res.ok) throw new Error("request_failed");
    } catch {
      setSubscribed(!next); // revert on failure
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-zinc-900">{t("account.settings.newsletterTitle")}</p>
        <p className="mt-0.5 text-sm text-zinc-500">{t("account.settings.newsletterBody")}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={subscribed ?? false}
        disabled={subscribed === null || pending}
        onClick={toggle}
        className={`press relative h-7 w-12 shrink-0 rounded-full ring-1 ring-inset transition disabled:opacity-60 ${
          subscribed ? "bg-indigo-600 ring-indigo-600" : "bg-zinc-200 ring-zinc-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            subscribed ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
