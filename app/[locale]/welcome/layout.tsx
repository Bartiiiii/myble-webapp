import { localeFromParams, privateMetadata } from "../../../lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return privateMetadata("welcome", await localeFromParams(params));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
