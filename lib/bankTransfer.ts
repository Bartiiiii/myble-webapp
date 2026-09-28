// Bank transfer details shown to customers while Comgate isn't live yet
// (PAYMENTS_ENABLED === false). Pure, dependency-free — safe to import from
// both client components and server code, same convention as lib/model.ts.

/** FLAG FOR BARTI: confirm this bank name matches account 7921807003/5500 —
 *  inferred from the CZ bank code (5500 = Raiffeisenbank a.s.) but not verified
 *  against Barti's actual online banking. */
export const BANK_TRANSFER_ACCOUNT_NUMBER = "7921807003/5500";
export const BANK_TRANSFER_BANK_NAME = "Raiffeisenbank a.s.";

/** Default assumption — Barti has not explicitly confirmed a due-date policy.
 *  Change this one constant to adjust it everywhere it's shown (page + email). */
export const BANK_TRANSFER_DUE_DAYS = 5;

/**
 * Derives a valid Czech bank variable symbol (numeric only, <=10 digits) from
 * an order number like "MB-2026-1234". CZ banks reject/garble a VS containing
 * letters, so the raw order number can't be used directly — strip everything
 * but digits, then cap at 10.
 */
export function variableSymbolFromOrderNo(orderNo: string): string {
  return orderNo.replace(/\D/g, "").slice(0, 10);
}
