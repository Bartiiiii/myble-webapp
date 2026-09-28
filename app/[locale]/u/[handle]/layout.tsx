import { localeFromParams, profileMetadata } from "../../../../lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { handle } = await params;
  return profileMetadata(decodeURIComponent(handle), await localeFromParams(params));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
