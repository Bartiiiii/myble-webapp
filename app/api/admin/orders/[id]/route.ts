import { NextResponse } from "next/server";
import { backstageApiStatus } from "@/lib/adminAuth";
import { createAdminClient } from "@/utils/supabase/admin";

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
  const { error } = await supabase.from("orders").update({ status: body.status }).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
