import { quoteDesign } from "./quote";
import { presetDesign } from "./build";
import { DELIVERY_DEADLINE_DAYS } from "./deliveryDeadline";

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
    name: "Custom shelves",
    description: "Made-to-measure shelves for an alcove, under the stairs, or in a bookcase. Exact to the centimetre.",
    image: ["/steps/step-3.jpg", "/img/story/story-05-done.jpg"],
  },
  {
    id: "skrinka",
    name: "Custom narrow cabinet",
    description: "Made-to-measure narrow cabinet with shelves and a vertical divider, sized to your space.",
    image: ["/img/story/story-05-done.jpg", "/steps/step-3.jpg"],
  },
  {
    id: "stolek",
    name: "Custom side table",
    description: "Made-to-measure side or bedside table, built to the height and footprint you need.",
    image: ["/img/story/story-05b-piece.jpg"],
  },
] as const;

export const PRODUCTS_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": PRODUCTS.map((p) => {
    const quote = quoteDesign(presetDesign(p.id));
    return {
      "@type": "Product",
      "@id": `${SITE_URL}/#product-${p.id}`,
      name: p.name,
      description: p.description,
      image: p.image.map((src) => `${SITE_URL}${src}`),
      brand: { "@type": "Brand", name: "Myble" },
      offers: {
        "@type": "Offer",
        price: quote.kitCZK,
        priceCurrency: "CZK",
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        url: `${SITE_URL}/design`,
        seller: { "@id": `${SITE_URL}/#org` },
        shippingDetails: shippingDetails(quote.deliveryCZK),
        hasMerchantReturnPolicy: RETURN_POLICY,
      },
    };
  }),
};
