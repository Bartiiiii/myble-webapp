import HomeClient from "./HomeClient";
import { localeFromParams, pageMetadata } from "../../lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata("home", await localeFromParams(params));
}

export default function HomePage() {
  return <HomeClient />;
}
