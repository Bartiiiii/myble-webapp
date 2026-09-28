"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Cookie / tracking consent (B6 — Czech opt-in law).
//
//  • Non-essential trackers stay OFF until the user opts in.
//  • Granular categories: analytics (PostHog) + marketing (Google Ads).
//  • Choice stored in the `myble_consent` cookie (see Cookies Policy).
//  • On change we (a) drive Google Consent Mode v2 and (b) opt PostHog in/out.
//  • Every decision is ALSO appended to a server-side audit log (/api/consent),
//    so we hold durable proof of consent independent of the visitor's device —
//    the Cookiebot-equivalent record a regulator would ask for.
//
// Google Consent Mode is *defaulted to denied* in app/layout.tsx before gtag
// loads; this module only sends `update` calls once the user chooses.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { enablePostHog, disablePostHog } from "./posthogClient";
import { LEGAL_DOCS } from "./legal";
import { pathLocaleSegment, segmentToLocale } from "./locale";

export type ConsentCategory = "analytics" | "marketing";
export type ConsentState = { analytics: boolean; marketing: boolean };

/** Which action produced a consent record — recorded in the audit log. */
type ConsentAction = "accept_all" | "reject_all" | "save" | "withdraw";

export const CONSENT_COOKIE = "myble_consent";
const CONSENT_VERSION = 1;
// Cookies-Policy version in force, recorded with each consent so we can prove
// which wording the visitor saw. Sourced from the legal registry.
const POLICY_VERSION = LEGAL_DOCS["cookies-policy"].version;
const LOCALE_STORAGE_KEY = "myble.locale";

const DENIED: ConsentState = { analytics: false, marketing: false };
const GRANTED: ConsentState = { analytics: true, marketing: true };

// `cid` is an anonymous, per-browser id that groups this visitor's successive
// decisions in the audit log. It is minted once and preserved across changes.
type StoredConsent = { v: number; analytics: boolean; marketing: boolean; ts: string; cid?: string };

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function readStored(): StoredConsent | null {
  const raw = readCookie(CONSENT_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed && parsed.v === CONSENT_VERSION && typeof parsed.analytics === "boolean") return parsed;
  } catch {
    /* ignore malformed cookie */
  }
  return null;
}

/** Reuse this browser's existing anonymous consent id, or mint a fresh one. */
function getOrCreateConsentId(): string {
  const existing = readStored()?.cid;
  if (typeof existing === "string" && existing) return existing;
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for the rare environment without crypto.randomUUID.
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }
}

function readLocale(): string {
  const seg = pathLocaleSegment(window.location.pathname);
  if (seg) return segmentToLocale(seg);
  try {
    const v = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === "en" || v === "cs") return v;
  } catch {
    /* ignore */
  }
  return "cs";
}

function writeStored(state: ConsentState, cid: string) {
  const payload: StoredConsent = { v: CONSENT_VERSION, ...state, ts: new Date().toISOString(), cid };
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(payload))};path=/;max-age=15552000;samesite=lax`;
}

// Append the decision to the server-side audit log. Best-effort and non-blocking:
// sendBeacon survives navigation; a keepalive fetch is the fallback. A failure
// here never affects the consent UI or the trackers.
function logConsent(state: ConsentState, action: ConsentAction, cid: string) {
  if (typeof navigator === "undefined") return;
  const body = JSON.stringify({
    consentId: cid,
    analytics: state.analytics,
    marketing: state.marketing,
    action,
    consentVersion: CONSENT_VERSION,
    policyVersion: POLICY_VERSION,
    locale: readLocale(),
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/consent", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    void fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* best-effort only */
  }
}

// Push a Google Consent Mode v2 update. gtag is set up in the root layout.
function applyGoogleConsent(state: ConsentState) {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] };
  const gtag =
    w.gtag ??
    function gtagShim(...args: unknown[]) {
      (w.dataLayer = w.dataLayer || []).push(args);
    };
  gtag("consent", "update", {
    analytics_storage: state.analytics ? "granted" : "denied",
    ad_storage: state.marketing ? "granted" : "denied",
    ad_user_data: state.marketing ? "granted" : "denied",
    ad_personalization: state.marketing ? "granted" : "denied",
  });
}

// PostHog is only initialised once analytics consent is granted; withdrawing
// consent opts it back out. Before the first grant it never loads at all.
function applyPostHogConsent(state: ConsentState) {
  if (state.analytics) enablePostHog();
  else disablePostHog();
}

function applyAll(state: ConsentState) {
  applyGoogleConsent(state);
  applyPostHogConsent(state);
}

interface ConsentCtx {
  /** Whether a decision has been made yet (drives the banner). */
  decided: boolean;
  consent: ConsentState;
  /** Timestamp of the last decision, ISO string, or null. */
  savedAt: string | null;
  acceptAll: () => void;
  rejectAll: () => void;
  save: (state: ConsentState) => void;
  /** Re-open the settings dialog (footer "Cookie settings"). */
  openSettings: () => void;
  settingsOpen: boolean;
  closeSettings: () => void;
}

const Ctx = createContext<ConsentCtx | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [decided, setDecided] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(DENIED);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Hydrate any previously-stored choice after mount and re-apply it to the
  // trackers (so a returning visitor's opt-in is honoured on load).
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      const state = { analytics: stored.analytics, marketing: stored.marketing };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConsent(state);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDecided(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedAt(stored.ts);
      applyAll(state);
    }
  }, []);

  const save = useCallback((state: ConsentState, action: ConsentAction = "save") => {
    const cid = getOrCreateConsentId();
    writeStored(state, cid);
    applyAll(state);
    logConsent(state, action, cid);
    setConsent(state);
    setDecided(true);
    setSavedAt(new Date().toISOString());
    setSettingsOpen(false);
  }, []);

  const acceptAll = useCallback(() => save(GRANTED, "accept_all"), [save]);
  // Turning everything off after a prior opt-in is a withdrawal (distinct from a
  // first-time rejection) — recorded as such in the audit log.
  const rejectAll = useCallback(() => {
    const hadConsent = decided && (consent.analytics || consent.marketing);
    save(DENIED, hadConsent ? "withdraw" : "reject_all");
  }, [save, decided, consent.analytics, consent.marketing]);

  const value = useMemo<ConsentCtx>(
    () => ({
      decided,
      consent,
      savedAt,
      acceptAll,
      rejectAll,
      save,
      openSettings: () => setSettingsOpen(true),
      settingsOpen,
      closeSettings: () => setSettingsOpen(false),
    }),
    [decided, consent, savedAt, acceptAll, rejectAll, save, settingsOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConsent(): ConsentCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConsent must be used within ConsentProvider");
  return ctx;
}
