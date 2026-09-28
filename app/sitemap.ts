import type { MetadataRoute } from "next";
import { LEGAL_SLUGS } from "../lib/legal";
import { SITE_URL } from "../lib/structuredData";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/design`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/library`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.5 },
  ];
  const legal: MetadataRoute.Sitemap = LEGAL_SLUGS.map((slug) => ({
    url: `${SITE_URL}/legal/${slug}`,
    changeFrequency: "yearly",
    priority: 0.2,
  }));
  return [...pages, ...legal];
}
