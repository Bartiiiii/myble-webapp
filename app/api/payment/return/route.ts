import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { syncPaymentByTransId } from "@/lib/payments";
import { siteUrl } from "@/lib/comgate/config";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payment/return?order=MB-2026-1234&result=paid|cancelled|pending
//
// Where Comgate sends the BROWSER after checkout. This is a UX redirect, not a
// source of truth — `result` is a query parameter, so a customer can type
// ?result=paid by hand. We ignore it for state purposes and re-read the real
// status from the API, exactly as the webhook does.
//
// This route exists because the push notification and the browser return race
// each other. Whichever arrives first wins; the second is a no-op.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderNo = url.searchParams.get("order");
  const base = siteUrl();

  if (!orderNo) {
    return NextResponse.redirect(`${base}/order/confirmation?error=missing_order`, 303);
  }

  const dest = (state: string) =>
    `${base}/order/confirmation?order=${encodeURIComponent(orderNo)}&payment=${state}`;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("payments")
      .select("trans_id, status")
      .eq("order_no", orderNo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.trans_id) {
      return NextResponse.redirect(dest("unknown"), 303);
    }

    const { payment } = await syncPaymentByTransId(data.trans_id as string, "return");

    switch (payment.status) {
      case "paid":
      case "authorized":
        return NextResponse.redirect(dest("paid"), 303);
      case "cancelled":
      case "failed":
        return NextResponse.redirect(dest("cancelled"), 303);
      default:
        // Bank transfers can legitimately sit PENDING for hours. Tell the
        // customer their order is placed and we're waiting on the bank — do not
        // show a failure.
        return NextResponse.redirect(dest("pending"), 303);
    }
  } catch (err) {
    console.error("[payment/return] sync failed", { orderNo, err });
    // Never strand the customer on an error page. The webhook will reconcile.
    return NextResponse.redirect(dest("pending"), 303);
  }
}
