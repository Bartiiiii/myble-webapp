import { Resend } from "resend";
import type { ConsentRecord, Customer } from "@/app/api/order/route";
import { localizePath } from "./locale";
// ^ type-only import: erased at compile time, so this module never pulls in
// next/server or the route handler at runtime.

// ─────────────────────────────────────────────────────────────────────────────
// Transactional e-mail (B5 — order confirmation on a durable medium).
//
// Sends the order confirmation with links to the accepted Terms & Conditions,
// the model withdrawal form, and the Privacy Policy. The on-screen confirmation
// page remains the durable copy of record; this e-mail is the second durable
// medium required by B5.
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL = "https://my-ble.eu";

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

const copy = {
  en: {
    subject: (orderNo: string) => `Your Myble order ${orderNo} is confirmed`,
    greeting: (name: string) => (name ? `Hi ${name},` : "Hi,"),
    intro: "Thanks for your order — we have your design and we're sending it to production.",
    summaryTitle: "Order summary",
    order: "Order",
    dimensions: "Dimensions",
    colour: "Colour",
    thickness: "Thickness",
    total: "Total",
    paymentTitle: "Payment instructions",
    paymentIntro: "Please pay by bank transfer using the details below:",
    paymentAccount: "Account number",
    paymentBank: "Bank",
    paymentVS: "Variable symbol",
    paymentAmount: "Amount",
    paymentDue: (n: number) => `Please transfer within ${n} business days.`,
    /** Replaces `intro` while payments are off: production has NOT started yet. */
    introAwaitingPayment:
      "Thanks for your order — we have your design. Production starts as soon as your payment arrives.",
    docsTitle: "Your documents",
    docsBody: "Keep these for your records:",
    terms: "Terms & Conditions",
    withdrawal: "Model withdrawal form (DOCX)",
    privacy: "Privacy Policy",
    footer: "Questions about your order? Reply to this e-mail or write to myble.eu@gmail.com.",
  },
  cs: {
    subject: (orderNo: string) => `Vaše objednávka Myble ${orderNo} je potvrzena`,
    greeting: (name: string) => (name ? `Dobrý den, ${name},` : "Dobrý den,"),
    intro: "Děkujeme za objednávku — máme váš návrh a předáváme jej do výroby.",
    summaryTitle: "Souhrn objednávky",
    order: "Objednávka",
    dimensions: "Rozměry",
    colour: "Barva",
    thickness: "Tloušťka",
    total: "Celkem",
    paymentTitle: "Platební údaje",
    paymentIntro: "Uhraďte prosím bankovním převodem podle údajů níže:",
    paymentAccount: "Číslo účtu",
    paymentBank: "Banka",
    paymentVS: "Variabilní symbol",
    paymentAmount: "Částka",
    paymentDue: (n: number) => `Prosíme o úhradu do ${n} pracovních dnů.`,
    /** Nahrazuje `intro`, dokud nejsou platby spuštěné: výroba ještě nezačala. */
    introAwaitingPayment:
      "Děkujeme za objednávku — máme váš návrh. Výrobu zahájíme, jakmile dorazí vaše platba.",
    docsTitle: "Vaše dokumenty",
    docsBody: "Uschovejte si je pro vlastní evidenci:",
    terms: "Obchodní podmínky",
    withdrawal: "Vzorový formulář pro odstoupení od smlouvy (DOCX)",
    privacy: "Zásady ochrany osobních údajů",
    footer: "Máte dotaz k objednávce? Odpovězte na tento e-mail nebo napište na myble.eu@gmail.com.",
  },
} as const;

export interface OrderConfirmationEmailParams {
  orderNo: string;
  customer?: Customer;
  consent: ConsentRecord;
  summary?: Record<string, unknown>;
  /** Set only when payments are off (bank-transfer flow) — omit/null once
   *  Comgate is live, since the customer has already paid by then. Computed by
   *  the caller (app/api/order/route.ts), not here — this module stays a pure
   *  function of its inputs, same reasoning as the "type-only import" note at
   *  the top of this file. */
  paymentInstructions?: {
    accountNumber: string;
    bankName: string;
    variableSymbol: string;
    amountCzk: number;
    dueDays: number;
  } | null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Exported for tests: the payment block must appear only while payments are off. */
export function buildHtml(params: OrderConfirmationEmailParams): string {
  const locale = params.consent.locale === "cs" ? "cs" : "en";
  const t = copy[locale];
  const name = escapeHtml([params.customer?.firstName, params.customer?.lastName].filter(Boolean).join(" "));
  const summary = params.summary ?? {};
  const withdrawalDoc = locale === "cs" ? "/legal/withdrawal-form-cz.docx" : "/legal/withdrawal-form-en.docx";

  const row = (label: string, value: unknown) =>
    value == null ? "" : `<tr><td style="padding:4px 12px 4px 0;color:#71717a;">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(String(value))}</td></tr>`;

  const dims = summary.width_cm && summary.height_cm && summary.depth_cm
    ? `${summary.width_cm}×${summary.height_cm}×${summary.depth_cm} cm`
    : undefined;

  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b;">
      <p>${t.greeting(name)}</p>
      <p>${params.paymentInstructions ? t.introAwaitingPayment : t.intro}</p>
      <h2 style="font-size:15px;margin-top:24px;">${t.summaryTitle}</h2>
      <table style="border-collapse:collapse;font-size:14px;">
        ${row(t.order, params.orderNo)}
        ${row(t.dimensions, dims)}
        ${row(t.colour, summary.colour)}
        ${row(t.thickness, summary.thickness_mm ? `${summary.thickness_mm} mm` : undefined)}
        ${row(t.total, summary.total_price_czk ? `${summary.total_price_czk} Kč` : undefined)}
      </table>
      ${params.paymentInstructions ? `
      <h2 style="font-size:15px;margin-top:24px;">${t.paymentTitle}</h2>
      <p style="font-size:14px;color:#3f3f46;">${t.paymentIntro}</p>
      <table style="border-collapse:collapse;font-size:14px;">
        ${row(t.paymentAccount, params.paymentInstructions.accountNumber)}
        ${row(t.paymentBank, params.paymentInstructions.bankName)}
        ${row(t.paymentVS, params.paymentInstructions.variableSymbol)}
        ${row(t.paymentAmount, `${params.paymentInstructions.amountCzk} Kč`)}
      </table>
      <p style="font-size:13px;color:#71717a;">${t.paymentDue(params.paymentInstructions.dueDays)}</p>
      ` : ""}
      <h2 style="font-size:15px;margin-top:24px;">${t.docsTitle}</h2>
      <p style="font-size:14px;color:#3f3f46;">${t.docsBody}</p>
      <p style="font-size:14px;">
        <a href="${SITE_URL}${localizePath("/legal/terms-and-conditions", locale)}" style="color:#4f46e5;">${t.terms}</a><br/>
        <a href="${SITE_URL}${withdrawalDoc}" style="color:#4f46e5;">${t.withdrawal}</a><br/>
        <a href="${SITE_URL}${localizePath("/legal/privacy-policy", locale)}" style="color:#4f46e5;">${t.privacy}</a>
      </p>
      <p style="margin-top:24px;font-size:12px;color:#a1a1aa;">${t.footer}</p>
    </div>
  `.trim();
}

/**
 * Sends the order confirmation e-mail. Never throws — a delivery failure must
 * not break order placement (the on-screen confirmation is the durable copy
 * of record regardless). Returns whether the send was attempted/succeeded.
 */
export async function sendOrderConfirmationEmail(
  params: OrderConfirmationEmailParams
): Promise<{ sent: boolean; reason?: string }> {
  const to = params.customer?.email;
  if (!to) return { sent: false, reason: "no_recipient" };

  const client = getClient();
  if (!client) return { sent: false, reason: "no_api_key" };

  const locale = params.consent.locale === "cs" ? "cs" : "en";
  const from = process.env.RESEND_FROM_EMAIL || "Myble <onboarding@resend.dev>";

  try {
    const { error } = await client.emails.send({
      from,
      to,
      subject: copy[locale].subject(params.orderNo),
      html: buildHtml(params),
    });
    if (error) {
      console.error("[email] resend send failed", { orderNo: params.orderNo, error });
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] resend send threw", { orderNo: params.orderNo, err });
    return { sent: false, reason: "exception" };
  }
}
