"use client";

import Script from "next/script";
import { useConsent } from "../lib/consent";

const GA_ID = "G-SVZB1QP98X";

// B6: Google Analytics (gtag.js) is only injected AFTER the visitor grants
// analytics consent — so no Google network call fires on page load. Consent
// Mode v2 defaults are set denied in app/layout.tsx; lib/consent.tsx sends the
// `update` when consent changes.
export function Analytics() {
  const { consent } = useConsent();
  if (!consent.analytics && !consent.marketing) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics-config" strategy="afterInteractive">
        {`gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
