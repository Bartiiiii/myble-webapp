import { localeFromParams, pageMetadata } from "../../../lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata("mybleplus", await localeFromParams(params));
}

export default function MyblePlusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
