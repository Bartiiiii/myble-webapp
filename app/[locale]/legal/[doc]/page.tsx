import { notFound } from "next/navigation";
import { LegalDocView } from "../../../../components/LegalDocView";
import { LEGAL_SLUGS, isLegalSlug } from "../../../../lib/legal";
import { readLegalMarkdown } from "../../../../lib/legalServer";
import { legalMetadata, localeFromParams } from "../../../../lib/seo";

// Six statically-generated legal pages per locale (/cz/legal/..., /en/legal/...).
// LegalDocView picks the document matching the locale context. Content is read
// verbatim from `legal-source/` at build time.
export function generateStaticParams() {
  return LEGAL_SLUGS.map((doc) => ({ doc }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { doc } = await params;
  if (!isLegalSlug(doc)) return {};
  return legalMetadata(doc, await localeFromParams(params));
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isLegalSlug(doc)) notFound();

  const { en, cs } = readLegalMarkdown(doc);

  return <LegalDocView slug={doc} en={en} cs={cs} />;
}
