// ─────────────────────────────────────────────────────────────────────────────
// Rewards domain layer: refer-a-friend codes, vouchers and myble+ points.
//
// The promo bar advertises these offers, so they have to be real. Every number
// comes from lib/promotions.ts; every rule is enforced here, on the server:
//
//   1. A CODE IS CHECKED TWICE. Once when the customer applies it at checkout
//      (/api/promo/validate, for the price preview) and again inside /api/order
//      before the discount is written onto the order. The payment step then
//      re-prices from that stored, server-written discount (lib/payments.ts).
//
//   2. A VOUCHER IS SPENT EXACTLY ONCE. reserveDiscount() claims it with a
//      conditional UPDATE (… where redeemed_order_no is null), so two orders
//      racing for the same code cannot both win.
//
//   3. REWARDS PAY OUT ONCE, AND ONLY FOR CONFIRMED ORDERS. Points and the
//      referrer's voucher are issued when an order reaches "confirmed" (paid),
//      keyed on (reason, ref) / (source, source_ref) in the database, so
//      calling awardOrderRewards() from several places is safe.
//
// SERVER ONLY — same convention as utils/supabase/admin.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { randomInt } from "crypto";
import { Resend } from "resend";
import { createAdminClient } from "@/utils/supabase/admin";
import { quoteDesign } from "@/lib/quote";
import type { Design } from "@/lib/model";
import { localizePath } from "@/lib/locale";
import {
  LOYALTY_DESIGN_PUBLISHED_POINTS,
  LOYALTY_REWARDS,
  REFERRAL_FRIEND_CZK,
  REFERRAL_REWARD_CZK,
  VOUCHER_VALID_DAYS,
  minKitFor,
  normalizeCode,
  pointsFor,
} from "@/lib/promotions";

const SITE_URL = "https://my-ble.eu";

/** Order statuses that mean "paid and going ahead". */
export const REWARDABLE_STATUSES = ["confirmed", "in_production", "shipped", "delivered"] as const;

const normEmail = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

// ── Code generation ──────────────────────────────────────────────────────────

// No 0/O, 1/I/L: these get read out over the phone and typed off a screenshot.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomChars(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** "Tereza Nováková" → "TEREZA7K3Q": personal enough to trust, short enough to type. */
function referralCodeFor(nameHint: string | null | undefined): string {
  const first = (nameHint ?? "").split(/[\s@._-]+/)[0] ?? "";
  const ascii = first.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8);
  return `${ascii.length >= 2 ? ascii : "MYBLE"}${randomChars(4)}`;
}

const voucherCode = () => `MYB-${randomChars(4)}-${randomChars(4)}`;

function expiresAt(): string {
  return new Date(Date.now() + VOUCHER_VALID_DAYS * 86_400_000).toISOString();
}

// ── Checking a code ──────────────────────────────────────────────────────────

export type DiscountRejection =
  | "not_found"
  | "email_required"
  | "own_code"
  | "not_new_customer"
  | "min_order"
  | "used"
  | "expired"
  | "wrong_email";

export type DiscountCheck =
  | {
      ok: true;
      kind: "referral" | "voucher";
      code: string;
      discountCzk: number;
      minKitCzk: number;
      referrerEmail: string | null;
    }
  | { ok: false; reason: DiscountRejection; minKitCzk?: number };

/**
 * Can `email` use `rawCode` on a kit priced `kitCzk`? Pure read, no side effects.
 * `excludeOrderNo` lets /api/order ignore the order it is about to write when
 * asking "is this a new customer".
 */
export async function checkDiscount(input: {
  code: string;
  email: string | null | undefined;
  kitCzk: number;
  excludeOrderNo?: string;
}): Promise<DiscountCheck> {
  const code = normalizeCode(input.code);
  const email = normEmail(input.email);
  if (!code) return { ok: false, reason: "not_found" };

  const supabase = createAdminClient();

  // Referral codes: a friend's first order.
  const { data: ref } = await supabase
    .from("referral_codes")
    .select("code, owner_email")
    .eq("code", code)
    .maybeSingle();
  if (ref) {
    const minKitCzk = minKitFor(REFERRAL_FRIEND_CZK);
    if (!email) return { ok: false, reason: "email_required" };
    if (normEmail(ref.owner_email as string) === email) return { ok: false, reason: "own_code" };
    let q = supabase.from("orders").select("id", { count: "exact", head: true }).eq("email", email).neq("status", "cancelled");
    if (input.excludeOrderNo) q = q.neq("order_no", input.excludeOrderNo);
    const { count } = await q;
    if ((count ?? 0) > 0) return { ok: false, reason: "not_new_customer" };
    if (input.kitCzk < minKitCzk) return { ok: false, reason: "min_order", minKitCzk };
    return {
      ok: true,
      kind: "referral",
      code,
      discountCzk: REFERRAL_FRIEND_CZK,
      minKitCzk,
      referrerEmail: normEmail(ref.owner_email as string),
    };
  }

  // Vouchers: single use, owned by one e-mail.
  const { data: v } = await supabase
    .from("vouchers")
    .select("code, email, amount_czk, min_kit_czk, expires_at, redeemed_order_no")
    .eq("code", code)
    .maybeSingle();
  if (!v) return { ok: false, reason: "not_found" };
  if (!email) return { ok: false, reason: "email_required" };
  if (v.redeemed_order_no && v.redeemed_order_no !== input.excludeOrderNo) return { ok: false, reason: "used" };
  if (v.expires_at && new Date(v.expires_at as string).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (normEmail(v.email as string) !== email) return { ok: false, reason: "wrong_email" };
  const minKitCzk = v.min_kit_czk as number;
  if (input.kitCzk < minKitCzk) return { ok: false, reason: "min_order", minKitCzk };
  return { ok: true, kind: "voucher", code, discountCzk: v.amount_czk as number, minKitCzk, referrerEmail: null };
}

/**
 * Claim a checked discount for an order. Vouchers are taken atomically; a
 * referral code has nothing to claim (its limit is "first order", checked
 * above). Returns false if someone else got the voucher first.
 */
export async function reserveDiscount(check: Extract<DiscountCheck, { ok: true }>, orderNo: string): Promise<boolean> {
  if (check.kind !== "voucher") return true;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vouchers")
    .update({ redeemed_order_no: orderNo, redeemed_at: new Date().toISOString() })
    .eq("code", check.code)
    .is("redeemed_order_no", null)
    .select("code");
  return (data?.length ?? 0) > 0;
}

// ── Referral codes ───────────────────────────────────────────────────────────

/** The customer's shareable code, created on first use. */
export async function getOrCreateReferralCode(email: string, nameHint?: string | null): Promise<string> {
  const owner = normEmail(email);
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("referral_codes").select("code").eq("owner_email", owner).maybeSingle();
  if (existing?.code) return existing.code as string;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = referralCodeFor(nameHint || owner);
    const { error } = await supabase.from("referral_codes").insert({ code, owner_email: owner });
    if (!error) return code;
    // Lost a race with another tab creating this owner's code: read theirs.
    const { data: again } = await supabase.from("referral_codes").select("code").eq("owner_email", owner).maybeSingle();
    if (again?.code) return again.code as string;
  }
  throw new Error("could not allocate a referral code");
}

// ── Account summary ──────────────────────────────────────────────────────────

export interface LedgerEntry {
  points: number;
  reason: string;
  ref: string;
  created_at: string;
}

export interface VoucherRow {
  code: string;
  amount_czk: number;
  min_kit_czk: number;
  source: string;
  created_at: string;
  expires_at: string | null;
  redeemed_order_no: string | null;
}

export interface RewardsSummary {
  referralCode: string;
  points: number;
  ledger: LedgerEntry[];
  vouchers: VoucherRow[];
  /** Friends whose first order used this customer's code and went ahead. */
  referralsConfirmed: number;
  /** Friends' orders placed with the code but not confirmed yet. */
  referralsPending: number;
}

export async function getRewardsSummary(email: string, nameHint?: string | null): Promise<RewardsSummary> {
  const owner = normEmail(email);
  const supabase = createAdminClient();
  const [referralCode, ledgerRes, vouchersRes, referredRes] = await Promise.all([
    getOrCreateReferralCode(owner, nameHint),
    supabase.from("loyalty_ledger").select("points, reason, ref, created_at").eq("email", owner).order("created_at", { ascending: false }),
    supabase
      .from("vouchers")
      .select("code, amount_czk, min_kit_czk, source, created_at, expires_at, redeemed_order_no")
      .eq("email", owner)
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("status").eq("referrer_email", owner),
  ]);
  const ledger = (ledgerRes.data ?? []) as LedgerEntry[];
  const referred = (referredRes.data ?? []) as { status: string }[];
  return {
    referralCode,
    points: ledger.reduce((sum, e) => sum + e.points, 0),
    ledger: ledger.slice(0, 30),
    vouchers: (vouchersRes.data ?? []) as VoucherRow[],
    referralsConfirmed: referred.filter((o) => (REWARDABLE_STATUSES as readonly string[]).includes(o.status)).length,
    referralsPending: referred.filter((o) => o.status === "received").length,
  };
}

/** Swap points for a voucher at one of the LOYALTY_REWARDS tiers. */
export async function redeemPoints(email: string, tierIndex: number): Promise<{ ok: true; code: string } | { ok: false; reason: "invalid_tier" | "insufficient" }> {
  const tier = LOYALTY_REWARDS[tierIndex];
  if (!tier) return { ok: false, reason: "invalid_tier" };
  const supabase = createAdminClient();
  const code = voucherCode();
  const { data, error } = await supabase.rpc("redeem_loyalty_points", {
    p_email: normEmail(email),
    p_points: tier.points,
    p_amount_czk: tier.czk,
    p_min_kit: minKitFor(tier.czk),
    p_code: code,
    p_expires_at: expiresAt(),
  });
  if (error) throw new Error(`redeem failed: ${error.message}`);
  if (!data) return { ok: false, reason: "insufficient" };
  return { ok: true, code: data as string };
}

// ── Payouts ──────────────────────────────────────────────────────────────────

interface OrderForRewards {
  order_no: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  locale: string | null;
  design: unknown;
  kit_price_czk: number | null;
  discount_kind: string | null;
  discount_czk: number | null;
  referrer_email: string | null;
}

const ORDER_COLUMNS =
  "order_no, email, phone, street, zip, locale, design, kit_price_czk, discount_kind, discount_czk, referrer_email";

function kitPaid(order: OrderForRewards): number {
  let kit = order.kit_price_czk ?? 0;
  if (order.design && typeof order.design === "object") {
    try {
      kit = quoteDesign(order.design as Design).kitCZK;
    } catch {
      /* fall back to the stored kit price */
    }
  }
  return Math.max(0, kit - (order.discount_czk ?? 0));
}

/**
 * Self-referral guard: the "friend" shares a phone number or a delivery
 * address with the referrer's own orders. The friend keeps their discount (it
 * was shown and accepted at checkout); only the referrer's reward is withheld.
 */
async function looksLikeSelfReferral(order: OrderForRewards): Promise<boolean> {
  if (!order.referrer_email) return false;
  const supabase = createAdminClient();
  const { data } = await supabase.from("orders").select("phone, street, zip").eq("email", order.referrer_email);
  const clean = (s: string | null) => (s ?? "").replace(/\s+/g, "").toLowerCase();
  return (data ?? []).some(
    (o) =>
      (clean(o.phone) && clean(o.phone) === clean(order.phone)) ||
      (clean(o.street) && clean(o.street) === clean(order.street) && clean(o.zip) === clean(order.zip)),
  );
}

/**
 * Pay out everything an order earns once it is confirmed: myble+ points for the
 * buyer, and the referrer's voucher if a friend's code was used. Idempotent.
 */
export async function awardOrderRewards(orderNo: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("orders").select(ORDER_COLUMNS).eq("order_no", orderNo).maybeSingle();
    const order = data as OrderForRewards | null;
    if (!order) return;
    const email = normEmail(order.email);

    const points = pointsFor(kitPaid(order));
    if (email && points > 0) {
      await supabase
        .from("loyalty_ledger")
        .upsert({ email, points, reason: "order", ref: orderNo }, { onConflict: "reason,ref", ignoreDuplicates: true });
    }

    if (order.discount_kind === "referral" && order.referrer_email) {
      if (await looksLikeSelfReferral(order)) {
        console.warn("[rewards] referral reward withheld: matches referrer's own details", { orderNo });
        return;
      }
      const code = voucherCode();
      const { data: issued } = await supabase
        .from("vouchers")
        .upsert(
          {
            code,
            email: order.referrer_email,
            amount_czk: REFERRAL_REWARD_CZK,
            min_kit_czk: minKitFor(REFERRAL_REWARD_CZK),
            source: "referral_reward",
            source_ref: orderNo,
            expires_at: expiresAt(),
          },
          { onConflict: "source,source_ref", ignoreDuplicates: true },
        )
        .select("code");
      // Only a freshly issued voucher gets an e-mail; a repeat call is a no-op.
      if (issued?.length) await sendReferralRewardEmail(order.referrer_email, code, order.locale);
    }
  } catch (err) {
    // Never let a reward failure break a payment or a status change.
    console.error("[rewards] award failed", { orderNo, err });
  }
}

/** Undo what a cancelled order earned and give back the voucher it used. */
export async function reverseOrderRewards(orderNo: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: earned } = await supabase
      .from("loyalty_ledger")
      .select("email, points")
      .eq("reason", "order")
      .eq("ref", orderNo)
      .maybeSingle();
    if (earned) {
      await supabase
        .from("loyalty_ledger")
        .upsert(
          { email: earned.email, points: -(earned.points as number), reason: "order_reversal", ref: orderNo },
          { onConflict: "reason,ref", ignoreDuplicates: true },
        );
    }
    // The voucher this order spent becomes usable again.
    await supabase.from("vouchers").update({ redeemed_order_no: null, redeemed_at: null }).eq("redeemed_order_no", orderNo);
    // A referral reward not spent yet is withdrawn; a spent one stays spent.
    await supabase
      .from("vouchers")
      .update({ expires_at: new Date().toISOString() })
      .eq("source", "referral_reward")
      .eq("source_ref", orderNo)
      .is("redeemed_order_no", null);
  } catch (err) {
    console.error("[rewards] reversal failed", { orderNo, err });
  }
}

/** Points for a design approved into the public library. Idempotent per design. */
export async function awardDesignPublished(designId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("designs").select("user_email").eq("id", designId).maybeSingle();
    const email = normEmail(data?.user_email as string | null);
    if (!email) return;
    await supabase
      .from("loyalty_ledger")
      .upsert(
        { email, points: LOYALTY_DESIGN_PUBLISHED_POINTS, reason: "design_published", ref: designId },
        { onConflict: "reason,ref", ignoreDuplicates: true },
      );
  } catch (err) {
    console.error("[rewards] design award failed", { designId, err });
  }
}

// ── E-mail ───────────────────────────────────────────────────────────────────

async function sendReferralRewardEmail(to: string, code: string, locale: string | null): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const cs = (locale ?? "cs").startsWith("cs");
  const amount = new Intl.NumberFormat("cs-CZ").format(REFERRAL_REWARD_CZK);
  const min = new Intl.NumberFormat("cs-CZ").format(minKitFor(REFERRAL_REWARD_CZK));
  const link = `${SITE_URL}${localizePath("/design", cs ? "cs" : "en")}`;
  const subject = cs ? `Máte ${amount} Kč na další kus od Myble` : `You have ${amount} Kč toward your next Myble piece`;
  const lines = cs
    ? [
        "Dobrý den,",
        `někdo, komu jste doporučili Myble, právě dostal svou první objednávku do výroby. Děkujeme. Tady je vaše odměna, ${amount} Kč na další objednávku:`,
        `<p style="font-family:ui-monospace,monospace;font-size:20px;letter-spacing:2px;margin:16px 0"><strong>${code}</strong></p>`,
        `Kód zadejte v pokladně. Platí 12 měsíců na sadu od ${min} Kč, s e-mailem, na který přišla tato zpráva.`,
        `<a href="${link}">Navrhnout další kus</a>`,
      ]
    : [
        "Hi,",
        `someone you referred to Myble just had their first order confirmed. Thank you. Here is your reward, ${amount} Kč off your next order:`,
        `<p style="font-family:ui-monospace,monospace;font-size:20px;letter-spacing:2px;margin:16px 0"><strong>${code}</strong></p>`,
        `Enter the code at checkout. Valid for 12 months on kits from ${min} Kč, with the e-mail address this message was sent to.`,
        `<a href="${link}">Design your next piece</a>`,
      ];
  try {
    await new Resend(apiKey).emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Myble <onboarding@resend.dev>",
      to,
      subject,
      html: lines.map((l) => (l.startsWith("<") ? l : `<p>${l}</p>`)).join(""),
    });
  } catch (err) {
    console.error("[rewards] reward e-mail failed", { err });
  }
}
