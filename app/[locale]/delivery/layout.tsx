import { localeFromParams, pageMetadata } from "../../../lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata("delivery", await localeFromParams(params));
}

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
