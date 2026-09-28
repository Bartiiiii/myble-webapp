"use client";

// Locale-aware drop-ins for next/link and next/navigation. Write paths as if
// the site had no language prefix ("/design"); these add /cz or /en from the
// current locale, and useLocalePathname() strips it again for comparisons.

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { forwardRef, useMemo } from "react";
import { useI18n } from "./i18n";
import { localizePath, stripLocale } from "./locale";

type LinkProps = React.ComponentProps<typeof NextLink>;

const LocaleLink = forwardRef<HTMLAnchorElement, LinkProps>(function LocaleLink({ href, ...rest }, ref) {
  const { locale } = useI18n();
  const localized: LinkProps["href"] =
    typeof href === "string"
      ? localizePath(href, locale)
      : href.pathname
        ? { ...href, pathname: localizePath(href.pathname, locale) }
        : href;
  return <NextLink ref={ref} href={localized} {...rest} />;
});

export default LocaleLink;

/** Prefixes a site path with the current locale. */
export function useLocalizePath(): (path: string) => string {
  const { locale } = useI18n();
  return useMemo(() => (path: string) => localizePath(path, locale), [locale]);
}

/** next/navigation's router, with push/replace/prefetch localized. */
export function useLocaleRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const lp = useLocalizePath();
  return useMemo(
    () => ({
      ...router,
      push: (href, ...rest) => router.push(lp(href), ...rest),
      replace: (href, ...rest) => router.replace(lp(href), ...rest),
      prefetch: (href, ...rest) => router.prefetch(lp(href), ...rest),
    }),
    [router, lp],
  );
}

/** The current pathname without its /cz or /en prefix ("/cz/design" → "/design"). */
export function useLocalePathname(): string {
  return stripLocale(usePathname() ?? "/");
}
