// ─────────────────────────────────────────────────────────────────────────────
// Comgate Merchant API v2.0 — wire types.
//
// Source: https://apidoc.comgate.cz/en/api/rest/  (base https://payments.comgate.cz/v2.0/)
//
// TWO THINGS TO NEVER FORGET IN THIS FILE:
//   1. `price` is in the currency's MINOR UNIT (haléře for CZK, grosze for PLN).
//      CZK 2 490 → 249000. Getting this wrong charges 100× or 1/100×.
//   2. `label` is limited to 16 characters. Our order numbers are `MB-2026-1234`
//      (12 chars), which fits — but anything longer is rejected by the API.
// ─────────────────────────────────────────────────────────────────────────────

/** Comgate transaction lifecycle. There is no "REFUNDED" status — a fully
 *  refunded payment stays PAID; we track refunds ourselves. */
export type ComgateStatus = "PENDING" | "PAID" | "CANCELLED" | "AUTHORIZED";

/** Result codes returned in every response body. 0 = OK. */
export const COMGATE_OK = 0;
export const COMGATE_CODES: Record<number, string> = {
  0: "OK",
  1100: "Unknown error",
  1200: "Database error",
  1301: "Unknown e-shop",
  1400: "Bad request / payment cannot be cancelled",
  1401: "Refunded payment is cancelled",
  1402: "Refund amount exceeds the paid amount",
  1500: "Comgate server error",
};

export interface ComgateBaseResponse {
  code: number;
  message: string;
}

// ── Create payment ───────────────────────────────────────────────────────────

export type ComgateDelivery = "HOME_DELIVERY" | "PICKUP" | "ELECTRONIC_DELIVERY";
export type ComgateCategory = "PHYSICAL_GOODS_ONLY" | "OTHER";

export interface ComgateCreatePaymentRequest {
  /** Test mode. Must mirror COMGATE_TEST — a test payment never settles. */
  test?: boolean;
  /** Amount in MINOR UNITS (haléře). 249000 = CZK 2 490.00 */
  price: number;
  /** ISO 4217, e.g. "CZK", "PLN". */
  curr: string;
  /** Shown to the payer on the gateway and in their bank statement. MAX 16 CHARS. */
  label: string;
  /** Our order number. Comes back on every status call and push notification. */
  refId: string;
  /** "ALL" shows every enabled method. Or a specific id / group expression. */
  method: string;
  email: string;
  phone?: string;
  fullName?: string;
  country?: string;
  lang?: string;

  // 3DS / risk-scoring hints. Supplying these measurably improves frictionless
  // 3DS pass rates, so we always send them for physical goods.
  billingAddrCity?: string;
  billingAddrStreet?: string;
  billingAddrPostalCode?: string;
  billingAddrCountry?: string;
  delivery?: ComgateDelivery;
  homeDeliveryCity?: string;
  homeDeliveryStreet?: string;
  homeDeliveryPostalCode?: string;
  homeDeliveryCountry?: string;
  category?: ComgateCategory;

  /** Product identifier for reporting. */
  name?: string;
  /** Authorize now, capture later. Cards + Apple/Google Pay ONLY. */
  preauth?: boolean;
  initRecurring?: boolean;
  verification?: boolean;
  /** `^[1-9][0-9]*(m|h|d)$` — e.g. "30m", "2h", "7d". */
  expirationTime?: string;
  dynamicExpiration?: boolean;
  url_paid?: string;
  url_cancelled?: string;
  url_pending?: string;
  enableApplePayGooglePay?: boolean;
  threeDSPreference?: "AUTO" | "FAST";
}

export interface ComgateCreatePaymentResponse extends ComgateBaseResponse {
  /** Comgate's transaction id. Our foreign key into their system. */
  transId: string;
  /** Where to send the browser. */
  redirect: string;
}

// ── Status ───────────────────────────────────────────────────────────────────

export interface ComgateStatusResponse extends ComgateBaseResponse {
  transId: string;
  status: ComgateStatus;
  /** MINOR UNITS, as a string. Parse with Number(). */
  price: string;
  curr: string;
  label: string;
  refId: string;
  /** Which method the payer actually used, e.g. "CARD_CZ_CSOB_2", "BANK_CZ_KB_PSD2". */
  method: string;
  email?: string;
  name?: string;
  phone?: string;
  payerId?: string;
  payerName?: string;
  payerAcc?: string;
  account?: string;
  /** Comgate's fee on this transaction, if exposed on your tariff. */
  fee?: string;
  vs?: string;
  cardValid?: string;
  /** Masked PAN. Never store more than this. */
  cardNumber?: string;
  appliedFee?: number;
  appliedFeeType?: string;
  /** Why a card was declined — surface this to ops, never verbatim to the payer. */
  paymentErrorReason?: string;
  threeDSPreference?: string;
  threeDSApplied?: boolean;
  test?: string;
}

// ── Refund / capture ─────────────────────────────────────────────────────────

export interface ComgateRefundRequest {
  transId: string;
  /** MINOR UNITS. Partial refunds are allowed; the sum may not exceed the payment. */
  amount: number;
  test?: boolean;
  refId?: string;
}

export interface ComgatePreauthCaptureRequest {
  /** MINOR UNITS. Omit to capture the full authorized amount. May not exceed it. */
  amount?: number;
}

// ── Methods ──────────────────────────────────────────────────────────────────

export interface ComgateMethod {
  id: string;
  group: string;
  name: string;
  description?: string;
  logo?: string;
  logos?: Record<string, string>;
}

export interface ComgateMethodsResponse extends ComgateBaseResponse {
  methods: ComgateMethod[];
}

// ── Settlement / transfers (used by the reconciliation job) ───────────────────

export interface ComgateTransfer {
  transferId: string | number;
  transferDate: string;
  accountCounterparty?: string;
  accountOutgoing?: string;
  variableSymbol?: string;
}

export interface ComgateSingleTransfer extends ComgateBaseResponse {
  transferId: string | number;
  transferDate?: string;
  accountCounterparty?: string;
  accountOutgoing?: string;
  variableSymbol?: string;
  /** Field names vary by tariff; we persist the whole object as jsonb. */
  [key: string]: unknown;
}

// ── Push notification (url_push) ─────────────────────────────────────────────

/**
 * What Comgate POSTs to our notify endpoint.
 *
 * CRITICAL SECURITY NOTE: there is NO HMAC signature on this payload. Comgate's
 * own documentation says to verify by (a) checking the shared `secret` and
 * (b) calling the status API for the authoritative result. We do BOTH and we
 * treat this payload as nothing more than a hint that something changed.
 *
 * v2.0 payments send JSON; v1.0 payments send form-encoded. We accept both
 * because the content type depends on which API created the payment.
 */
export interface ComgatePushPayload {
  transId?: string;
  refId?: string;
  merchant?: string;
  /** The shared secret, echoed back. Compare in constant time. */
  secret?: string;
  status?: ComgateStatus;
  price?: string | number;
  curr?: string;
  label?: string;
  method?: string;
  email?: string;
  test?: string | boolean;
  [key: string]: unknown;
}
