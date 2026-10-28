import { NextResponse } from "next/server";
import { backstageApiStatus } from "@/lib/adminAuth";
import { createAdminClient } from "@/utils/supabase/admin";
import { REWARDABLE_STATUSES, awardOrderRewards, reverseOrderRewards } from "@/lib/rewards";

const ALLOWED_STATUSES = [
  "received",
  "confirmed",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const status = await backstageApiStatus();
  if (status) return NextResponse.json({ ok: false }, { status });

  const { id } = await ctx.params;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.status || !ALLOWED_STATUSES.includes(body.status as (typeof ALLOWED_STATUSES)[number])) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status: body.status })
    .eq("id", id)
    .select("order_no")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // While online payment is off, "confirmed" is set here by hand once the bank
  // transfer lands, so this is where a paid order earns its myble+ points and
  // its referrer's voucher. Both are idempotent (lib/rewards.ts).
  const orderNo = updated?.order_no as string | undefined;
  if (orderNo) {
    if ((REWARDABLE_STATUSES as readonly string[]).includes(body.status)) await awardOrderRewards(orderNo);
    if (body.status === "cancelled") await reverseOrderRewards(orderNo);
  }
  return NextResponse.json({ ok: true });
}
