import { NextResponse } from "next/server";
import { backstageApiStatus } from "@/lib/adminAuth";
import { createAdminClient } from "@/utils/supabase/admin";
import { capturePaymentById, refundPaymentById, releasePaymentById } from "@/lib/payments";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/orders/[id]/review   { decision: "approved" | "rejected", note?: string }
//
// The design-review gate Barti asked for: nothing goes to meble.pl until a human
// has looked at the configuration. The rules engine already runs server-side at
// order time and flags designs via validateConfiguratorDesign().needsReview —
// this route records the human decision on top of that.
//
// What the decision does to the money depends on CAPTURE_MODE:
//
//   immediate (default)  approve → nothing; the money is already captured
//                        reject  → full refund, automatically
//
//   preauth              approve → capture the held authorization
//                        reject  → release the hold; nothing ever leaves the
//                                  customer's account
//
// Either way the operator clicks one button and the right thing happens.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await backstageApiStatus();
  if (gate) return NextResponse.json({ ok: false }, { status: gate });

  const { id } = await ctx.params;
  let body: { decision?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ ok: false, error: "invalid_decision" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_no, review_state, payment_status")
    .eq("id", id)
    .maybeSingle();

  if (!order) return NextResponse.json({ ok: false, error: "unknown_order" }, { status: 404 });
  if (order.review_state !== "pending") {
    return NextResponse.json(
      { ok: false, error: `already ${order.review_state}` },
      { status: 409 },
    );
  }

  // Find the settled payment for this order, if any.
  const { data: payment } = await supabase
    .from("payments")
    .select("id, status")
    .eq("order_id", id)
    .in("status", ["paid", "authorized", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let moneyAction: string = "none";
  try {
    if (decision === "approved") {
      if (payment?.status === "authorized") {
        await capturePaymentById(payment.id as string);
        moneyAction = "captured";
      }
    } else {
      if (payment?.status === "paid") {
        await refundPaymentById(payment.id as string);
        moneyAction = "refunded";
      } else if (payment?.status === "authorized" || payment?.status === "pending") {
        await releasePaymentById(payment.id as string);
        moneyAction = "released";
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/review] money action failed", { orderNo: order.order_no, message });
    // Do NOT record the decision if the money move failed — an order marked
    // rejected with the customer still charged is the worst possible state.
    return NextResponse.json({ ok: false, error: `money_action_failed: ${message}` }, { status: 502 });
  }

  const { error } = await supabase
    .from("orders")
    .update({
      review_state: decision,
      reviewed_at: new Date().toISOString(),
      review_note: body.note ?? null,
      // Approved + paid means it is genuinely ready for meble.pl.
      ...(decision === "approved" ? { status: "in_production" } : { status: "cancelled" }),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, decision, moneyAction });
}
