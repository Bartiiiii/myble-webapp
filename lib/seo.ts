import type { Metadata } from "next";
import { localizePath, segmentToLocale, type Locale } from "./locale";
import type { LegalSlug } from "./legal";

// Per-page <title>/<meta description>, canonical URL and hreflang alternates for
// both languages. Server-only: lib/i18n.tsx is a client module, so page SEO copy
// lives here. House rule: no em dashes in copy.

type Copy = { title: string; description: string };
type PageKey = "home" | "design" | "library" | "about" | "contact" | "delivery" | "refer" | "mybleplus";

const PAGES: Record<PageKey, { path: string; en: Copy; cs: Copy }> = {
  home: {
    path: "/",
    en: {
      title: "Myble | made-to-measure furniture, exact to the centimetre",
      description:
        "Custom shelves, cabinets and tables for any alcove. See the price instantly, design in 5 minutes, assemble in 30. Delivery across Czechia.",
    },
    cs: {
      title: "Myble | nábytek na míru, přesně na centimetr",
      description:
        "Police, skříňky a stolky na míru do každé niky. Cenu vidíte hned, navrhnete za 5 minut, složíte za 30. Doručení po celé ČR.",
    },
  },
  design: {
    path: "/design",
    en: {
      title: "Design custom shelves online | Myble",
      description:
        "Set width, height and depth to the centimetre, pick a finish and watch the price update live. No drawing skills needed.",
    },
    cs: {
      title: "Navrhněte si police na míru online | Myble",
      description:
        "Zadejte šířku, výšku a hloubku na centimetr, vyberte dekor a sledujte, jak se mění cena. Kreslit umět nemusíte.",
    },
  },
  library: {
    path: "/library",
    en: {
      title: "Furniture design ideas from the community | Myble",
      description:
        "Browse shelves, cabinets and tables designed by other Myble customers. Open any design, fit it to your space and order it.",
    },
    cs: {
      title: "Inspirace: návrhy nábytku od komunity | Myble",
      description:
        "Prohlédněte si police, skříňky a stolky od ostatních zákazníků Myble. Otevřete návrh, upravte ho na svůj prostor a objednejte.",
    },
  },
  about: {
    path: "/about",
    en: {
      title: "About Myble | why we exist",
      description:
        "Myble started with one piece of furniture that didn't exist, and three weekends spent building it. The drawing, the cut list, the queue, the borrowed drill, and what we built so you don't have to.",
    },
    cs: {
      title: "O Myble | proč existujeme",
      description:
        "Myble začalo jedním kusem nábytku, který nikde nebyl k sehnání, a třemi víkendy jeho stavby. Výkres, nářezový plán, fronta, půjčená vrtačka a to, co jsme postavili, abyste nemuseli vy.",
    },
  },
  delivery: {
    path: "/delivery",
    en: {
      title: "Delivery and returns | Myble",
      description:
        "Delivery across Czechia for 499 Kč, free on kits from 10 000 Kč. Most orders arrive within 3 to 4 weeks of payment, always within 28 days.",
    },
    cs: {
      title: "Doprava a doručení | Myble",
      description:
        "Doprava po celé ČR za 499 Kč, u sady od 10 000 Kč zdarma. Většina objednávek dorazí do 3 až 4 týdnů od platby, vždy do 28 dnů.",
    },
  },
  refer: {
    path: "/refer",
    en: {
      title: "Give 500 Kč, get 500 Kč | Refer a friend to Myble",
      description:
        "Share your code: your friend saves 500 Kč on their first made-to-measure piece and you get a 500 Kč voucher when their order goes into production.",
    },
    cs: {
      title: "Dejte 500 Kč, získejte 500 Kč | Doporučte Myble",
      description:
        "Pošlete kamarádovi svůj kód: ušetří 500 Kč na první kus na míru a vy dostanete voucher na 500 Kč, jakmile jeho objednávka půjde do výroby.",
    },
  },
  mybleplus: {
    path: "/myble-plus",
    en: {
      title: "myble+ loyalty programme | Myble",
      description:
        "Earn a point for every 10 Kč you spend and 200 points for each design accepted into the library. Swap points for up to 1 500 Kč off.",
    },
    cs: {
      title: "myble+ věrnostní program | Myble",
      description:
        "Za každých 10 Kč získáte bod a za návrh přijatý do knihovny 200 bodů. Body vyměníte za slevu až 1 500 Kč.",
    },
  },
  contact: {
    path: "/contact",
    en: {
      title: "Contact | Myble",
      description: "A question about a design, an order or delivery? Get in touch with the Myble team.",
    },
    cs: {
      title: "Kontakt | Myble",
      description: "Máte otázku k návrhu, objednávce nebo doručení? Napište týmu Myble.",
    },
  },
};

const LEGAL_TITLES: Record<LegalSlug, Record<Locale, string>> = {
  "terms-and-conditions": { en: "Terms & Conditions", cs: "Obchodní podmínky" },
  "privacy-policy": { en: "Privacy Policy", cs: "Ochrana osobních údajů" },
  "cookies-policy": { en: "Cookies Policy", cs: "Zásady cookies" },
  "withdrawal-form": { en: "Withdrawal Form", cs: "Odstoupení od smlouvy" },
  "complaints-procedure": { en: "Complaints Procedure", cs: "Reklamační řád" },
  "product-safety": { en: "Product Safety & Assembly", cs: "Bezpečnost výrobku" },
};

type PrivateKey = "account" | "order" | "login" | "welcome" | "unsubscribed";
const PRIVATE_TITLES: Record<PrivateKey, Record<Locale, string>> = {
  account: { en: "My account | Myble", cs: "Můj účet | Myble" },
  order: { en: "Order | Myble", cs: "Objednávka | Myble" },
  login: { en: "Sign in | Myble", cs: "Přihlášení | Myble" },
  welcome: { en: "Welcome | Myble", cs: "Vítejte | Myble" },
  unsubscribed: { en: "Unsubscribed | Myble", cs: "Odhlášeno | Myble" },
};

const OG_LOCALE: Record<Locale, string> = { cs: "cs_CZ", en: "en_US" };

/** Canonical + hreflang for a site path. The homepage's x-default is the bare
 *  domain, which picks the visitor's language; elsewhere English is the fallback. */
export function alternatesFor(path: string, locale: Locale): Metadata["alternates"] {
  return {
    canonical: localizePath(path, locale),
    languages: {
      cs: localizePath(path, "cs"),
      en: localizePath(path, "en"),
      "x-default": path === "/" ? "/" : localizePath(path, "en"),
    },
  };
}

function build(path: string, locale: Locale, copy: Copy, type: "website" | "article" = "website"): Metadata {
  const url = localizePath(path, locale);
  return {
    title: copy.title,
    description: copy.description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      type,
      url,
      siteName: "Myble",
      locale: OG_LOCALE[locale],
      alternateLocale: [OG_LOCALE[locale === "cs" ? "en" : "cs"]],
      title: copy.title,
      description: copy.description,
      images: ["/opengraph-image"],
    },
    twitter: { card: "summary_large_image", title: copy.title, description: copy.description, images: ["/opengraph-image"] },
  };
}

export async function localeFromParams(params: Promise<{ locale: string }>): Promise<Locale> {
  return segmentToLocale((await params).locale);
}

export function pageMetadata(page: PageKey, locale: Locale): Metadata {
  const p = PAGES[page];
  return build(p.path, locale, p[locale], page === "about" ? "article" : "website");
}

export function legalMetadata(slug: LegalSlug, locale: Locale): Metadata {
  const title = `${LEGAL_TITLES[slug][locale]} | Myble`;
  const description =
    locale === "cs" ? `${LEGAL_TITLES[slug].cs} obchodu Myble.` : `Myble ${LEGAL_TITLES[slug].en.toLowerCase()}.`;
  return build(`/legal/${slug}`, locale, { title, description }, "article");
}

export function profileMetadata(handle: string, locale: Locale): Metadata {
  const copy =
    locale === "cs"
      ? { title: `Návrhy od @${handle} | Myble`, description: `Nábytek na míru od @${handle} v Myble.` }
      : { title: `Designs by @${handle} | Myble`, description: `Made-to-measure furniture designed by @${handle} on Myble.` };
  return build(`/u/${handle}`, locale, copy);
}

/** Transactional pages: localized tab title, kept out of search results. */
export function privateMetadata(page: PrivateKey, locale: Locale): Metadata {
  return { title: PRIVATE_TITLES[page][locale], robots: { index: false, follow: false } };
}
