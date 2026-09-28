import type { MetadataRoute } from "next";
import { LEGAL_SLUGS } from "../lib/legal";
import { localizePath, type Locale } from "../lib/locale";
import { SITE_URL } from "../lib/structuredData";

type Entry = { path: string; changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>; priority: number };

const PAGES: Entry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/design", changeFrequency: "weekly", priority: 0.9 },
  { path: "/library", changeFrequency: "daily", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
  ...LEGAL_SLUGS.map((slug): Entry => ({ path: `/legal/${slug}`, changeFrequency: "yearly", priority: 0.2 })),
];

const LOCALES: Locale[] = ["cs", "en"];
const abs = (path: string, locale: Locale) => `${SITE_URL}${localizePath(path, locale)}`;

// Each page appears once per language, and every entry lists both language
// versions so Google pairs /cz/... with /en/... (hreflang in the sitemap).
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, changeFrequency, priority }) =>
    LOCALES.map((locale) => ({
      url: abs(path, locale),
      changeFrequency,
      priority,
      alternates: { languages: { cs: abs(path, "cs"), en: abs(path, "en") } },
    })),
  );
}
