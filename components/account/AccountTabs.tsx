"use client";

import Link, { useLocalePathname } from "../../lib/localeNav";
import { useT } from "../../lib/i18n";

// The top tab bar the user asked for instead of a backstage-style left
// sidebar. Real <Link>s to real /account/* routes (not client-side state), so
// each tab is bookmarkable and the back button works — see the visual
// language borrowed from CategoryPills (pill row, dark active state), but
// with proper tab semantics since these switch pages, not filter a list.
const TABS = [
  { href: "/account", key: "overview" as const },
  { href: "/account/designs", key: "designs" as const },
  { href: "/account/orders", key: "orders" as const },
  { href: "/account/settings", key: "settings" as const },
];

export function AccountTabs() {
  const t = useT();
  const pathname = useLocalePathname();

  return (
    <div
      className="-mx-5 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label={t("account.overview.title")}
    >
      {TABS.map((tab) => {
        const isActive = tab.href === "/account" ? pathname === "/account" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`press inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${
              isActive
                ? "bg-zinc-900 text-white ring-zinc-900"
                : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {t(`account.nav.${tab.key}`)}
          </Link>
        );
      })}
    </div>
  );
}
