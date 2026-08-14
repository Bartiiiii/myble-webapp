import { notFound } from "next/navigation";
import { LegalDocView } from "../../../components/LegalDocView";
import { LEGAL_SLUGS, isLegalSlug } from "../../../lib/legal";
import { readLegalMarkdown } from "../../../lib/legalServer";

// Six statically-generated legal pages. Each serves both locales; the client
// LegalDocView picks EN/CZ from the locale context (the app has no per-locale
// URL routing). Content is read verbatim from `legal-source/` at build time.
export function generateStaticParams() {
  return LEGAL_SLUGS.map((doc) => ({ doc }));
}

export const dynamicParams = false;

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isLegalSlug(doc)) notFound();

  const { en, cs } = readLegalMarkdown(doc);

  return <LegalDocView slug={doc} en={en} cs={cs} />;
}
