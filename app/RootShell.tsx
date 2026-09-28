import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { ORGANIZATION_JSON_LD } from "../lib/structuredData";
import type { Locale } from "../lib/locale";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

// The <html> shell shared by the three root layouts: the language-routed site
// (app/[locale]), the backstage (app/admin) and the brand book (app/brand).
// `locale` is set only for the routed site; the others keep a client-side switch.
export function RootShell({ lang, locale, children }: { lang: string; locale?: Locale; children: React.ReactNode }) {
  return (
    <html lang={lang} data-scroll-behavior="smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        {/* B6: Google Consent Mode v2 — everything DENIED by default, before any
            Google tag loads. lib/consent.tsx sends `update` once the user
            chooses; the gtag.js script itself is not loaded until then
            (components/Analytics.tsx), so no marketing/analytics call fires on
            load. */}
        <Script id="google-consent-default" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = window.gtag || gtag;
            gtag('consent', 'default', {
              ad_storage: 'denied',
              analytics_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              wait_for_update: 500
            });
            gtag('js', new Date());
          `}
        </Script>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
