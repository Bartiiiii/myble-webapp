import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/structuredData";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/api/", "/order", "/login", "/welcome", "/brand", "/newsletter"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
