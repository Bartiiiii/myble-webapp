// ─────────────────────────────────────────────────────────────────────────────
// Comgate Merchant API v2.0 client.
//
// Hand-rolled on fetch — deliberately. Comgate's only first-party SDK is PHP
// (github.com/comgate-payments/sdk-php); the npm packages are community-
// maintained. The API surface we need is nine endpoints of flat JSON with Basic
// auth, so a 200-line typed client we control beats an unmaintained dependency.
//
// SERVER ONLY — same convention as utils/supabase/admin.ts. Importing this into
// a client component would ship COMGATE_SECRET to the browser. Never do that.
// ─────────────────────────────────────────────────────────────────────────────

import {
  COMGATE_BASE_URL,
  COMGATE_TEST,
  comgateMerchant,
  comgateSecret,
} from "./config";
import {
  COMGATE_CODES,
  COMGATE_OK,
  type ComgateBaseResponse,
  type ComgateCreatePaymentRequest,
  type ComgateCreatePaymentResponse,
  type ComgateMethodsResponse,
  type ComgatePreauthCaptureRequest,
  type ComgateRefundRequest,
  type ComgateSingleTransfer,
  type ComgateStatusResponse,
  type ComgateTransfer,
} from "./types";

export class ComgateError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly endpoint: string,
    readonly httpStatus?: number,
  ) {
    super(`Comgate ${endpoint} failed [${code}]: ${message}`);
    this.name = "ComgateError";
  }
}

function authHeader(): string {
  const raw = `${comgateMerchant()}:${comgateSecret()}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

/** Network-level retry. Comgate 5xx and timeouts are retried; 4xx never is. */
const RETRYABLE_HTTP = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 15_000;

async function request<T extends ComgateBaseResponse>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  // `unknown` rather than Record<string, unknown>: TS gives object *literals* an
  // implicit index signature but not interfaces, so a typed request object
  // (ComgatePreauthCaptureRequest) would not be assignable otherwise.
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${COMGATE_BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: authHeader(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);

      if (!res.ok && RETRYABLE_HTTP.has(res.status) && attempt < MAX_ATTEMPTS) {
        await sleep(250 * attempt);
        continue;
      }

      const text = await res.text();
      let json: T;
      try {
        json = JSON.parse(text) as T;
      } catch {
        throw new ComgateError(-1, `non-JSON response: ${text.slice(0, 200)}`, path, res.status);
      }

      if (json.code !== COMGATE_OK) {
        throw new ComgateError(
          json.code,
          json.message || COMGATE_CODES[json.code] || "unknown",
          path,
          res.status,
        );
      }
      return json;
    } catch (err) {
      clearTimeout(timer);
      // A business-level Comgate rejection is final — never retry it.
      if (err instanceof ComgateError) throw err;
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(250 * attempt);
        continue;
      }
    }
  }
  throw new ComgateError(-1, `network failure: ${String(lastErr)}`, path);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Payments ─────────────────────────────────────────────────────────────────

/**
 * Create a payment and get the redirect URL.
 * `test` is forced from COMGATE_TEST so a stray caller can never create a live
 * payment from a test deployment (or the reverse).
 */
export function createPayment(
  input: Omit<ComgateCreatePaymentRequest, "test">,
): Promise<ComgateCreatePaymentResponse> {
  return request<ComgateCreatePaymentResponse>("POST", "/payment.json", {
    ...input,
    test: COMGATE_TEST,
  });
}

/** The authoritative payment state. Call this, never trust a redirect or push. */
export function getPaymentStatus(transId: string): Promise<ComgateStatusResponse> {
  return request<ComgateStatusResponse>(
    "GET",
    `/payment/transId/${encodeURIComponent(transId)}.json`,
  );
}

/** Cancel a PENDING payment. Code 1400 means it is no longer cancellable. */
export function cancelPayment(transId: string): Promise<ComgateBaseResponse> {
  return request<ComgateBaseResponse>(
    "DELETE",
    `/payment/transId/${encodeURIComponent(transId)}.json`,
  );
}

/** Full or partial refund. `amount` is in MINOR UNITS. */
export function refundPayment(input: ComgateRefundRequest): Promise<ComgateBaseResponse> {
  return request<ComgateBaseResponse>("POST", "/refund.json", {
    ...input,
    test: input.test ?? COMGATE_TEST,
  });
}

// ── Pre-authorization (unused while CAPTURE_MODE === "immediate") ────────────

/** Capture an AUTHORIZED payment. Omit `amount` for the full authorized sum. */
export function capturePreauth(
  transId: string,
  input: ComgatePreauthCaptureRequest = {},
): Promise<ComgateBaseResponse> {
  return request<ComgateBaseResponse>(
    "PUT",
    `/preauth/transId/${encodeURIComponent(transId)}.json`,
    input,
  );
}

/** Release an authorization without taking the money. */
export function cancelPreauth(transId: string): Promise<ComgateBaseResponse> {
  return request<ComgateBaseResponse>(
    "DELETE",
    `/preauth/transId/${encodeURIComponent(transId)}.json`,
  );
}

// ── Methods ──────────────────────────────────────────────────────────────────

/**
 * Live list of methods available for a given amount/country/currency. Use this
 * if you ever build an in-page method picker instead of the hosted gateway —
 * it returns ids, localised names and logo URLs.
 */
export function listMethods(params: {
  lang?: string;
  curr?: string;
  country?: string;
  price?: number;
} = {}): Promise<ComgateMethodsResponse> {
  return request<ComgateMethodsResponse>("GET", "/method.json", undefined, params);
}

// ── Settlement (reconciliation job) ──────────────────────────────────────────

/** Transfers (payouts) settled on a given date. `date` is YYYY-MM-DD. */
export async function listTransfers(date: string): Promise<ComgateTransfer[]> {
  const res = await request<ComgateBaseResponse & { transferList?: ComgateTransfer[] }>(
    "GET",
    `/transferList/date/${date}.json`,
    undefined,
    { test: COMGATE_TEST },
  );
  // Comgate returns the array under `transferList` on some tariffs and at the
  // top level on others. Normalise both shapes.
  if (Array.isArray(res.transferList)) return res.transferList;
  if (Array.isArray(res)) return res as unknown as ComgateTransfer[];
  return [];
}

/** Line-level detail for one payout — this is what reconciles to orders. */
export function getTransfer(transferId: string | number): Promise<ComgateSingleTransfer> {
  return request<ComgateSingleTransfer>(
    "GET",
    `/singleTransfer/transferId/${encodeURIComponent(String(transferId))}.json`,
    undefined,
    { test: COMGATE_TEST },
  );
}
