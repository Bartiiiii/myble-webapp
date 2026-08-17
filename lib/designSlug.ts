import { randomBytes } from "node:crypto";

// Shared by /api/designs (anonymous share links) and /api/account/designs
// (account-owned saves) — both persist a Design JSON under a slug in the same
// `designs` table, so the slug format and shape validation must stay
// identical between the two call sites rather than drifting apart.

const SLUG_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const SLUG_RE = /^[A-Za-z0-9]{8}$/;
export const MAX_DESIGN_BYTES = 100_000;

export function makeSlug(): string {
  const bytes = randomBytes(8);
  let slug = "";
  for (const b of bytes) slug += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
  return slug;
}

export function isDesignShaped(v: unknown): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as { parts?: unknown }).parts) &&
    typeof (v as { outerCm?: unknown }).outerCm === "object"
  );
}
