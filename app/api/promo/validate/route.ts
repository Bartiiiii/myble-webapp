import { NextResponse } from "next/server";
import { checkDiscount } from "@/lib/rewards";
import { quoteDesign } from "@/lib/quote";
import type { Design } from "@/lib/model";

// POST { code, email, design } → { ok, kind, discountCzk } | { ok: false, reason, minKitCzk? }
//
// The checkout's "apply code" button. Preview only: nothing is reserved here.
// /api/order runs the same check again and claims the code when the order is
// written. The kit price is recomputed from the posted design, never taken
// from the browser.

export async function POST(req: Request) {
  let body: { code?: unknown; email?: unknown; design?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.slice(0, 40) : "";
  const email = typeof body.email === "string" ? body.email.slice(0, 200) : "";
  if (!code) return NextResponse.json({ ok: false, reason: "not_found" });

  let kitCzk = 0;
  try {
    if (body.design && typeof body.design === "object") kitCzk = quoteDesign(body.design as Design).kitCZK;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_design" }, { status: 400 });
  }

  try {
    const check = await checkDiscount({ code, email, kitCzk });
    if (!check.ok) return NextResponse.json(check);
    return NextResponse.json({ ok: true, kind: check.kind, code: check.code, discountCzk: check.discountCzk });
  } catch (err) {
    console.error("[promo/validate] failed", { err });
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
