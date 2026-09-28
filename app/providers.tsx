"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import { LocaleProvider } from "../lib/i18n";
import { ConsentProvider, useConsent } from "../lib/consent";
import { CookieConsent } from "../components/CookieConsent";
import { Analytics } from "../components/Analytics";
import posthog from "posthog-js";

function PostHogIdentify() {
  const { data: session } = useSession();
  const { consent } = useConsent();
  useEffect(() => {
    // Only identify once the visitor has allowed analytics (PostHog is opted
    // out by default — see instrumentation-client.ts).
    if (consent.analytics && session?.user?.email) {
      posthog.identify(session.user.email, {
        email: session.user.email,
        name: session.user.name ?? undefined,
      });
    }
  }, [session, consent.analytics]);
  return null;
}

/**
 * Every signed-in person gets a profile row, and a brand-new one is sent to
 * /welcome to confirm the name and avatar the community will see.
 *
 * This runs here rather than in a NextAuth callback because the decision needs
 * a page to happen on: the sign-in callback can only redirect everyone to one
 * place, while this sends first-timers to /welcome and leaves returning users
 * exactly where they were. One call per tab (guarded by sessionStorage), and
 * it also doubles as the "last seen" ping backstage → Users reads.
 */
function ProfileBootstrap() {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (pathname === "/welcome") return;
    // Never interrupt a checkout or the backstage: signing in mid-order (see
    // /order/login) would otherwise bounce the customer out of the flow they
    // came to finish. They get the profile prompt on their next ordinary page.
    if (pathname?.startsWith("/order") || pathname?.startsWith("/admin")) return;
    if (sessionStorage.getItem("myble.profile.checked") === "1") return;

    let cancelled = false;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body?.ok) return;
        sessionStorage.setItem("myble.profile.checked", "1");
        if (body.needsSetup) {
          // Carry the query string too, not just the path: a design lives in
          // ?d=<slug> and the pending share intent in ?share=, so dropping it
          // sends a first-timer back to an empty configurator.
          const here = (pathname || "/account") + window.location.search;
          router.push(`/welcome?next=${encodeURIComponent(here)}`);
        }
      })
      .catch(() => {
        /* profile setup can wait for the next page load */
      });
    return () => {
      cancelled = true;
    };
  }, [status, pathname, router]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>
        <ConsentProvider>
          <PostHogIdentify />
          <ProfileBootstrap />
          {children}
          <CookieConsent />
          <Analytics />
        </ConsentProvider>
      </LocaleProvider>
    </SessionProvider>
  );
}
