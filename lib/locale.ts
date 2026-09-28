// URL-level locale routing. The site lives under /cz/... and /en/...; the code
// and stored data (orders, consent records, e-mails) keep the language code
// "cs", so the URL segment is mapped at this boundary only.

export type Locale = "en" | "cs";
export type LocaleSegment = "en" | "cz";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "myble.locale";
export const LOCALE_SEGMENTS: readonly LocaleSegment[] = ["cz", "en"];

const SEGMENT_TO_LOCALE: Record<LocaleSegment, Locale> = { cz: "cs", en: "en" };
const LOCALE_TO_SEGMENT: Record<Locale, LocaleSegment> = { cs: "cz", en: "en" };

// Paths that are never language-prefixed: backstage, internal brand book, APIs.
const UNROUTED_PREFIXES = ["/admin", "/brand", "/api"];

export function isLocaleSegment(v: string | undefined): v is LocaleSegment {
  return v === "cz" || v === "en";
}

export function segmentToLocale(seg: string): Locale {
  return isLocaleSegment(seg) ? SEGMENT_TO_LOCALE[seg] : DEFAULT_LOCALE;
}

export function localeToSegment(locale: Locale): LocaleSegment {
  return LOCALE_TO_SEGMENT[locale];
}

export function isUnroutedPath(path: string): boolean {
  return UNROUTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

/** The locale segment a pathname starts with, if any. */
export function pathLocaleSegment(pathname: string): LocaleSegment | null {
  const first = pathname.slice(1).split(/[/?#]/)[0];
  return isLocaleSegment(first) ? first : null;
}

/** "/cz/design?d=x" → "/design?d=x"; "/en" → "/". Unprefixed paths pass through. */
export function stripLocale(path: string): string {
  const seg = pathLocaleSegment(path);
  if (!seg) return path;
  const rest = path.slice(seg.length + 1);
  if (rest === "") return "/";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/**
 * Prefix a same-site path with the locale: "/design" → "/cz/design", "/" → "/cz",
 * "/#jak" → "/cz#jak". Already-prefixed paths are re-targeted to `locale`.
 * External URLs, protocol-relative URLs, hash-only links and unrouted paths
 * (admin, brand, api) are returned unchanged.
 */
export function localizePath(path: string, locale: Locale): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const bare = stripLocale(path);
  if (isUnroutedPath(bare)) return bare;
  const seg = localeToSegment(locale);
  if (bare === "/") return `/${seg}`;
  if (bare.startsWith("/?") || bare.startsWith("/#")) return `/${seg}${bare.slice(1)}`;
  return `/${seg}${bare}`;
}

/** Slovak readers get Czech too: the languages are mutually intelligible. */
function localeFromTag(tag: string): Locale | null {
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  if (primary === "cs" || primary === "sk") return "cs";
  if (primary === "en") return "en";
  return null;
}

/**
 * Best locale from an Accept-Language header, honouring q-weights. Only an
 * explicit Czech/Slovak preference yields "cs"; anything else is English.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag, weight: Number.isFinite(weight) ? weight : 0, i };
    })
    .filter((x) => x.tag && x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  for (const { tag } of ranked) {
    const l = localeFromTag(tag);
    if (l) return l;
  }
  return DEFAULT_LOCALE;
}

/** Same rule for the browser's navigator.languages list. */
export function localeFromLanguages(langs: readonly string[] | undefined): Locale {
  for (const tag of langs ?? []) {
    const l = localeFromTag(tag);
    if (l) return l;
  }
  return DEFAULT_LOCALE;
}

export function parseLocaleCookie(v: string | undefined | null): Locale | null {
  return v === "cs" || v === "en" ? v : null;
}

/** An explicit earlier choice (cookie) always beats the browser's language. */
export function detectLocale(opts: { cookie?: string | null; acceptLanguage?: string | null }): Locale {
  return parseLocaleCookie(opts.cookie) ?? localeFromAcceptLanguage(opts.acceptLanguage);
}
