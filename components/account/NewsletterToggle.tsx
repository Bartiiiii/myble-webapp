"use client";

import Link from "next/link";
import React from "react";
import { useI18n } from "../../lib/i18n";

// Self-contained: fetches its own initial state on mount rather than the
// server component passing it down, since the state can change from other
// tabs/devices (e.g. unsubscribing via the e-mail link) and this is the one
// genuinely mutable setting on the page.
//
// Switch geometry is deliberate: the knob is pinned with an explicit `left-0.5`
// rather than left to its static position. Without it the knob lands wherever
// the button's inherited `text-align: center` puts it (24px in a 48px track)
// and the translate is applied on top of that, so the knob sat at the right
// edge while "off" and spilled outside the track while "on". Travel is
// track(48) - knob(24) - inset(2) - inset(2) = 20px = translate-x-5.
//
// Turning the newsletter OFF asks for confirmation first, so a stray click
// doesn't silently drop someone's subscription. Turning it ON stays instant,
// and the one-click unsubscribe link in the e-mails themselves
// (/api/newsletter/unsubscribe, RFC 8058) is deliberately left frictionless:
// consent must stay as easy to withdraw as it was to give.
export function NewsletterToggle() {
  const { t, locale } = useI18n();
  const [subscribed, setSubscribed] = React.useState<boolean | null>(null);
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const switchRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/account/newsletter")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setSubscribed(body?.ok ? !!body.subscribed : false);
      })
      .catch(() => {
        if (!cancelled) setSubscribed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function apply(next: boolean) {
    setPending(true);
    setFailed(false);
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
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  function onToggle() {
    if (subscribed === null || pending) return;
    if (subscribed) setConfirming(true); // unsubscribing: confirm first
    else void apply(true);
  }

  function closeConfirm() {
    setConfirming(false);
    switchRef.current?.focus();
  }

  const on = subscribed === true;
  const loading = subscribed === null;

  // One line that doubles as save feedback, so a failed write is visible
  // instead of the switch silently springing back.
  const status = failed
    ? { text: t("account.settings.newsletterError"), className: "text-rose-600" }
    : pending
      ? { text: t("account.settings.newsletterSaving"), className: "text-zinc-400" }
      : loading
        ? null
        : on
          ? { text: t("account.settings.newsletterOn"), className: "text-emerald-600" }
          : { text: t("account.settings.newsletterOff"), className: "text-zinc-400" };

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p id="newsletter-label" className="text-sm font-medium text-zinc-900">
            {t("account.settings.newsletterLabel")}
          </p>
          <p id="newsletter-description" className="mt-0.5 text-sm text-zinc-500">
            {t("account.settings.newsletterBody")}
          </p>
          <p className={`mt-2 h-4 text-xs font-medium ${status?.className ?? ""}`} aria-live="polite">
            {status?.text ?? ""}
          </p>
        </div>

        <button
          ref={switchRef}
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="newsletter-label"
          aria-describedby="newsletter-description"
          aria-busy={pending}
          disabled={loading || pending}
          onClick={onToggle}
          className={`press relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 ${
            on ? "bg-indigo-600 ring-indigo-600" : "bg-zinc-200 ring-zinc-300"
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out ${
              on ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <p className="mt-4 border-t border-zinc-100 pt-4 text-xs leading-relaxed text-zinc-500">
        {t("account.settings.newsletterConsent")}{" "}
        <Link href="/legal/privacy-policy" className="underline hover:text-zinc-700">
          {t("legal.docs.privacy-policy.title")}
        </Link>
      </p>

      {confirming ? (
        <ConfirmUnsubscribe
          onCancel={closeConfirm}
          onConfirm={() => {
            setConfirming(false);
            switchRef.current?.focus();
            void apply(false);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Confirmation step for turning the newsletter off. Both choices are plainly
 * labelled and equally reachable: this exists to catch accidental taps, not to
 * bury the way out.
 */
function ConfirmUnsubscribe({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const keepRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    keepRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      // Keep focus inside the dialog while it owns the screen.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  return (
    <div
      role="presentation"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="newsletter-unsub-title"
        aria-describedby="newsletter-unsub-body"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-900/10"
      >
        <h2 id="newsletter-unsub-title" className="text-base font-semibold text-zinc-900">
          {t("account.settings.newsletterUnsubTitle")}
        </h2>
        <p id="newsletter-unsub-body" className="mt-2 text-sm leading-relaxed text-zinc-600">
          {t("account.settings.newsletterUnsubBody")}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onConfirm}
            className="press rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {t("account.settings.newsletterUnsubConfirm")}
          </button>
          <button
            ref={keepRef}
            type="button"
            onClick={onCancel}
            className="press rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {t("account.settings.newsletterUnsubKeep")}
          </button>
        </div>
      </div>
    </div>
  );
}
