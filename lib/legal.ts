// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the legal / compliance layer.
//
//  • Document registry (slug → markdown files + i18n title/description keys).
//  • Document VERSIONS — recorded alongside consent (B4) so we can prove which
//    wording a customer accepted. Bump the version here whenever the matching
//    file in `legal-source/` changes. See LEGAL_IMPLEMENTATION.md.
//
// The markdown itself is the binding text and lives verbatim in `legal-source/`.
// Czech is the legally binding version; English is a courtesy translation.
// ─────────────────────────────────────────────────────────────────────────────

export type LegalSlug =
  | "terms-and-conditions"
  | "privacy-policy"
  | "cookies-policy"
  | "withdrawal-form"
  | "complaints-procedure"
  | "product-safety";

export interface LegalDocMeta {
  slug: LegalSlug;
  /** i18n key for the page title (under `legal.docs.<slug>.title`). */
  titleKey: string;
  /** Document version string, recorded with consent. */
  version: string;
}

// Versions mirror the "Version / Effective date" lines inside each file. Keep
// these in sync when a file changes (the withdrawal form carries no version line
// of its own, so it tracks the T&C release it ships with).
export const LEGAL_DOCS: Record<LegalSlug, LegalDocMeta> = {
  "terms-and-conditions": { slug: "terms-and-conditions", titleKey: "legal.docs.terms-and-conditions.title", version: "1.4" },
  "privacy-policy": { slug: "privacy-policy", titleKey: "legal.docs.privacy-policy.title", version: "1.2" },
  "cookies-policy": { slug: "cookies-policy", titleKey: "legal.docs.cookies-policy.title", version: "1.1" },
  "withdrawal-form": { slug: "withdrawal-form", titleKey: "legal.docs.withdrawal-form.title", version: "1.4" },
  "complaints-procedure": { slug: "complaints-procedure", titleKey: "legal.docs.complaints-procedure.title", version: "1.0" },
  "product-safety": { slug: "product-safety", titleKey: "legal.docs.product-safety.title", version: "1.0" },
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS) as LegalSlug[];

export function isLegalSlug(v: string): v is LegalSlug {
  return v in LEGAL_DOCS;
}

// The three documents a customer explicitly accepts at checkout (B4). The
// accepted versions are stored with the consent record.
export const CHECKOUT_ACCEPTED_DOCS: LegalSlug[] = [
  "terms-and-conditions",
  "complaints-procedure",
  "privacy-policy",
];

/** Versions of the checkout-accepted documents, e.g. `{ "terms-and-conditions": "1.1", … }`. */
export function acceptedDocVersions(): Record<string, string> {
  return Object.fromEntries(CHECKOUT_ACCEPTED_DOCS.map((s) => [s, LEGAL_DOCS[s].version]));
}
