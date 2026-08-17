import { NextResponse } from "next/server";
import { accountApiStatus } from "@/lib/accountAuth";
import { fetchAccountOrders } from "@/lib/accountData";

// GET → { ok, orders } — orders whose guest-checkout email matches the
// session e-mail. See lib/accountData.ts for the customer-safe column list
// and the best-effort-match caveat (orders aren't tied to an account).

export async function GET() {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  try {
    const orders = await fetchAccountOrders(email);
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("[account/orders] list threw", { err });
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }
}
