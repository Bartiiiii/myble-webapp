import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { FROM_PRICE } from "../lib/quote";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const SITE_URL = "https://my-ble.eu";
const TITLE = "Myble | made-to-measure furniture, exact to the centimetre";
const DESCRIPTION =
  "Custom shelves, cabinets and tables for any alcove. See the price instantly, design in 5 minutes, assemble in 30. Delivery across Czechia.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Myble",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Structured data for richer search results (Organization + Product offers).
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Myble",
      url: SITE_URL,
      email: "hello@my-ble.eu",
      areaServed: "CZ",
      description: DESCRIPTION,
    },
    {
      "@type": "Product",
      name: "Custom shelves",
      description: "Made-to-measure shelves for an alcove, under the stairs, or in a bookcase. Exact to the centimetre.",
      brand: { "@type": "Brand", name: "Myble" },
      offers: {
        "@type": "Offer",
        price: FROM_PRICE.police,
        priceCurrency: "CZK",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/design`,
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
