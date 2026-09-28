import { localeFromParams, pageMetadata } from "../../../lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata("design", await localeFromParams(params));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
