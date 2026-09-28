import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, detectLocale, localizePath, pathLocaleSegment } from "./lib/locale";

// Sends any unprefixed page URL (/, /about, old links, e-mail links) to its
// /cz or /en version. Prefixed URLs are never redirected, so Google can crawl
// both languages and a shared /en/... link stays English.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathLocaleSegment(pathname)) return NextResponse.next();

  const locale = detectLocale({
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  const url = request.nextUrl.clone();
  url.pathname = localizePath(pathname, locale);
  url.search = search;

  // 307: the target depends on the visitor, so it must never be cached as permanent.
  const res = NextResponse.redirect(url, 307);
  res.headers.set("Vary", "Accept-Language, Cookie");
  return res;
}

export const config = {
  matcher: [
    // Everything except APIs, backstage, the brand book, the analytics relay,
    // Next internals, generated metadata images and any file with an extension
    // (favicon.ico, sitemap.xml, robots.txt, the Google verification .html, images, .docx).
    "/((?!(?:api|admin|brand|ingest|_next|_vercel|opengraph-image)(?:/|$)|.*\\..*).*)",
  ],
};
