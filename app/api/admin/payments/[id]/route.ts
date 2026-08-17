import { NextResponse } from "next/server";
import { backstageApiStatus } from "@/lib/adminAuth";
import {
  capturePaymentById,
  refundPaymentById,
  releasePaymentById,
  syncPaymentByTransId,
} from "@/lib/payments";
import { createAdminClient } from "@/utils/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/payments/[id]
//
// One endpoint, four actions, all behind the existing two-gate backstage auth
// (Google session as ADMIN_EMAIL + signed backstage cookie). Matches the shape
// of app/api/admin/orders/[id]/route.ts.
//
//   { action: "sync" }                       re-read status from Comgate
//   { action: "refund", amountCzk?: number } full or partial refund
//   { action: "capture", amountCzk?: number } pre-auth only
//   { action: "release" }                    cancel a pending/authorized payment
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";

type Action = "sync" | "refund" | "capture" | "release";
const ACTIONS: readonly Action[] = ["sync", "refund", "capture", "release"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await backstageApiStatus();
  if (gate) return NextResponse.json({ ok: false }, { status: gate });

  const { id } = await ctx.params;
  let body: { action?: string; amountCzk?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const action = body.action as Action | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }

  try {
    switch (action) {
      case "sync": {
        const supabase = createAdminClient();
        const { data } = await supabase
          .from("payments")
          .select("trans_id")
          .eq("id", id)
          .maybeSingle();
        if (!data?.trans_id) {
          return NextResponse.json({ ok: false, error: "no_trans_id" }, { status: 404 });
        }
        const res = await syncPaymentByTransId(data.trans_id as string, "manual");
        return NextResponse.json({ ok: true, status: res.payment.status, changed: res.changed });
      }
      case "refund": {
        const res = await refundPaymentById(id, body.amountCzk);
        return NextResponse.json({
          ok: true,
          refundedCzk: res.refundedMinor / 100,
          fullyRefunded: res.fullyRefunded,
        });
      }
      case "capture": {
        await capturePaymentById(id, body.amountCzk);
        return NextResponse.json({ ok: true });
      }
      case "release": {
        await releasePaymentById(id);
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/payments] action failed", { id, action, message });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
