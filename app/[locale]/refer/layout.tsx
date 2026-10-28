import { localeFromParams, pageMetadata } from "../../../lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata("refer", await localeFromParams(params));
}

export default function ReferLayout({ children }: { children: React.ReactNode }) {
  return children;
}
