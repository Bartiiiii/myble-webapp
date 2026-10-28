import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { accountApiStatus } from "@/lib/accountAuth";
import { getRewardsSummary } from "@/lib/rewards";

// GET → { ok, summary } — the signed-in customer's referral code, myble+ points,
// history and vouchers. Scoped to the session e-mail, never a client value.

export async function GET() {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });
  try {
    const session = await getServerSession(authOptions);
    const summary = await getRewardsSummary(email, session?.user?.name ?? null);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[rewards] summary failed", { err });
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }
}
