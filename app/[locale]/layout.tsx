import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RootShell } from "../RootShell";
import { LanguageSuggestion } from "../../components/LanguageSuggestion";
import { LOCALE_SEGMENTS, isLocaleSegment, segmentToLocale } from "../../lib/locale";
import { SITE_URL } from "../../lib/structuredData";

export function generateStaticParams() {
  return LOCALE_SEGMENTS.map((locale) => ({ locale }));
}

export const dynamicParams = false;

// Pages set their own title/description/hreflang (lib/seo.ts); this only
// supplies the base URL so relative canonical and OG URLs resolve.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: seg } = await params;
  if (!isLocaleSegment(seg)) notFound();
  const locale = segmentToLocale(seg);

  return (
    <RootShell lang={locale} locale={locale}>
      <LanguageSuggestion />
      {children}
    </RootShell>
  );
}
