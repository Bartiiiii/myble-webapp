import { localeFromParams, pageMetadata } from "../../../lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata("about", await localeFromParams(params));
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
