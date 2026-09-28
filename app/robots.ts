import type { MetadataRoute } from "next";
import { LOCALE_SEGMENTS } from "../lib/locale";
import { SITE_URL } from "../lib/structuredData";

const PRIVATE = ["/account", "/order", "/login", "/welcome", "/newsletter"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/brand",
        ...PRIVATE,
        ...LOCALE_SEGMENTS.flatMap((seg) => PRIVATE.map((p) => `/${seg}${p}`)),
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
