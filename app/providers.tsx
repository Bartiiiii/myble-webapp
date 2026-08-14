"use client";

import { useEffect } from "react";
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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>
        <ConsentProvider>
          <PostHogIdentify />
          {children}
          <CookieConsent />
          <Analytics />
        </ConsentProvider>
      </LocaleProvider>
    </SessionProvider>
  );
}
