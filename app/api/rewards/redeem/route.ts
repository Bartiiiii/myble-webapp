import { NextResponse } from "next/server";
import { accountApiStatus } from "@/lib/accountAuth";
import { redeemPoints } from "@/lib/rewards";

// POST { tier } → { ok, code } — swap myble+ points for a voucher. The balance
// check and the spend happen in one locked database call (redeem_loyalty_points).

export async function POST(req: Request) {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  let body: { tier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const tier = typeof body.tier === "number" ? body.tier : -1;

  try {
    const result = await redeemPoints(email, tier);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 409 });
    return NextResponse.json({ ok: true, code: result.code });
  } catch (err) {
    console.error("[rewards/redeem] failed", { err });
    return NextResponse.json({ ok: false, error: "redeem_failed" }, { status: 500 });
  }
}
