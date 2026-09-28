import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { startPaymentForOrder } from "@/lib/payments";
import type { Design } from "@/lib/model";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/create
//
// Called by app/order/page.tsx immediately after /api/order has persisted the
// order. Takes ONLY an order number — deliberately. Everything needed to price
// and charge (the design, the address, the email) is already in the database,
// so there is no client-supplied amount anywhere in this path.
//
// Response: { ok: true, redirect } — the caller does window.location.assign().
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";

interface Body {
  orderNo?: string;
  /** What the browser displayed. Compared against the server price, never used. */
  displayedTotalCzk?: number;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const orderNo = body.orderNo?.trim();
  if (!orderNo) {
    return NextResponse.json({ ok: false, error: "missing_order_no" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_no, email, first_name, last_name, phone, street, city, zip, country, locale, design, payment_status, delivery_method",
    )
    .eq("order_no", orderNo)
    .maybeSingle();

  if (error) {
    console.error("[payment/create] order lookup failed", { orderNo, error: error.message });
    return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: "unknown_order" }, { status: 404 });
  }
  if (order.payment_status === "paid") {
    return NextResponse.json({ ok: false, error: "already_paid" }, { status: 409 });
  }
  if (!order.design) {
    // Without a design we cannot recompute the price, and we never charge a
    // price we did not compute.
    return NextResponse.json({ ok: false, error: "order_has_no_design" }, { status: 422 });
  }
  if (!order.email) {
    return NextResponse.json({ ok: false, error: "order_has_no_email" }, { status: 422 });
  }

  try {
    const result = await startPaymentForOrder({
      orderId: order.id as string,
      orderNo: order.order_no as string,
      design: order.design as unknown as Design,
      email: order.email as string,
      fullName: [order.first_name, order.last_name].filter(Boolean).join(" ") || null,
      phone: order.phone as string | null,
      street: order.street as string | null,
      city: order.city as string | null,
      zip: order.zip as string | null,
      country: order.country as string | null,
      locale: order.locale as string | null,
      deliveryMethod: order.delivery_method === "in-room" ? "in-room" : "curbside",
      clientTotalCzk: body.displayedTotalCzk ?? null,
    });

    return NextResponse.json({
      ok: true,
      redirect: result.redirect,
      amountCzk: result.amountCzk,
      transId: result.transId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[payment/create] failed", { orderNo, message });
    // A price mismatch is a distinct, actionable failure — surface it as such so
    // the checkout can tell the customer to reload rather than "try again".
    if (message.startsWith("price mismatch")) {
      return NextResponse.json({ ok: false, error: "price_changed" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "payment_create_failed" }, { status: 502 });
  }
}
