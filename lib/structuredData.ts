import { quoteDesign } from "./quote";
import { presetDesign } from "./build";
import { DELIVERY_DEADLINE_DAYS } from "./deliveryDeadline";
import { localizePath, type Locale } from "./locale";

export const SITE_URL = "https://my-ble.eu";

export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#org`,
  name: "Myble",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.ico`,
  email: "hello@my-ble.eu",
  areaServed: "CZ",
};

// Every piece is made to the customer's own dimensions, so the statutory 14-day
// withdrawal right does not apply (T&C §9) — returns are genuinely not offered.
const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "CZ",
  returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
};

// Handling + transit together stay within the contractual 28-day ceiling (T&C §6.2a).
const shippingDetails = (deliveryCZK: number) => ({
  "@type": "OfferShippingDetails",
  shippingRate: { "@type": "MonetaryAmount", value: deliveryCZK, currency: "CZK" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "CZ" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: DELIVERY_DEADLINE_DAYS - 7, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 7, unitCode: "DAY" },
  },
});

const PRODUCTS = [
  {
    id: "police",
    name: { en: "Custom shelves", cs: "Police na míru" },
    description: {
      en: "Made-to-measure shelves for an alcove, under the stairs, or in a bookcase. Exact to the centimetre.",
      cs: "Police na míru do niky, pod schody nebo do knihovny. Přesně na centimetr.",
    },
    image: ["/steps/step-3.jpg", "/img/story/story-05-done.jpg"],
  },
  {
    id: "skrinka",
    name: { en: "Custom narrow cabinet", cs: "Úzká skříňka na míru" },
    description: {
      en: "Made-to-measure narrow cabinet with shelves and a vertical divider, sized to your space.",
      cs: "Úzká skříňka na míru s policemi a svislou příčkou, přesně do vašeho prostoru.",
    },
    image: ["/img/story/story-05-done.jpg", "/steps/step-3.jpg"],
  },
  {
    id: "stolek",
    name: { en: "Custom side table", cs: "Odkládací stolek na míru" },
    description: {
      en: "Made-to-measure side or bedside table, built to the height and footprint you need.",
      cs: "Odkládací nebo noční stolek na míru, v přesné výšce a velikosti, kterou potřebujete.",
    },
    image: ["/img/story/story-05b-piece.jpg"],
  },
] as const;

export function productsJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@graph": PRODUCTS.map((p) => {
      const quote = quoteDesign(presetDesign(p.id));
      return {
        "@type": "Product",
        "@id": `${SITE_URL}${localizePath("/", locale)}#product-${p.id}`,
        name: p.name[locale],
        description: p.description[locale],
        image: p.image.map((src) => `${SITE_URL}${src}`),
        brand: { "@type": "Brand", name: "Myble" },
        offers: {
          "@type": "Offer",
          price: quote.kitCZK,
          priceCurrency: "CZK",
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          url: `${SITE_URL}${localizePath("/design", locale)}`,
          seller: { "@id": `${SITE_URL}/#org` },
          shippingDetails: shippingDetails(quote.deliveryCZK),
          hasMerchantReturnPolicy: RETURN_POLICY,
        },
      };
    }),
  };
}
