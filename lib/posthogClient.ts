// PostHog is initialised LAZILY — only once the visitor has granted analytics
// consent (B6). Before that, posthog-js is never `init`ed, so it makes no
// network call and sets no cookie. The `posthog.capture(...)` calls scattered
// across the app are safe no-ops until init runs.
import posthog from "posthog-js";

const CONSENT_COOKIE = "myble_consent";

let initialised = false;

/** Read analytics consent straight from the cookie (no React needed). */
export function hasAnalyticsConsent(): boolean {
  if (typeof document === "undefined") return false;
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!m) return false;
  try {
    return JSON.parse(decodeURIComponent(m[1]))?.analytics === true;
  } catch {
    return false;
  }
}

/** Initialise PostHog once. Safe to call repeatedly. */
export function initPostHog() {
  if (initialised || typeof window === "undefined") return;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
  initialised = true;
}

/** Init + start capturing (called when analytics consent is granted). */
export function enablePostHog() {
  initPostHog();
  try {
    posthog.opt_in_capturing();
  } catch {
    /* not initialised (e.g. missing token) */
  }
}

/** Stop capturing (called when analytics consent is withdrawn/denied). */
export function disablePostHog() {
  try {
    if (initialised) {
      posthog.opt_out_capturing();
      // Withdrawal must also clear what was already stored, not just stop new
      // capture. The SDK stays alive in memory, though, and will keep flushing
      // its persistence (device_id, session) to disk — so first switch it to
      // memory-only persistence, then reset() to drop the identity, and only
      // then wipe the on-disk `ph_*` entries. Order matters: clearing before
      // switching lets the live SDK re-persist a fresh identifier.
      posthog.set_config({ persistence: "memory" });
      posthog.reset(true);
    }
  } catch {
    /* ignore */
  }
  clearPostHogStorage();
}

/** Remove PostHog's `ph_*` cookie + localStorage entries after opt-out. */
function clearPostHogStorage() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("ph_") || key.startsWith("__ph_")) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* storage unavailable — nothing to clear */
  }
  try {
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0]?.trim() ?? "";
      if (name.startsWith("ph_") || name.startsWith("__ph_")) {
        document.cookie = `${name}=;path=/;max-age=0;samesite=lax`;
      }
    }
  } catch {
    /* ignore */
  }
}

/** On first load, init only if the visitor already granted analytics. */
export function maybeInitPostHog() {
  if (hasAnalyticsConsent()) enablePostHog();
}
