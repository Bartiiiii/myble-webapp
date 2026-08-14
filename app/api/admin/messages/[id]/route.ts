import { NextResponse } from "next/server";
import { backstageApiStatus } from "@/lib/adminAuth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const status = await backstageApiStatus();
  if (status) return NextResponse.json({ ok: false }, { status });

  const { id } = await ctx.params;
  let body: { handled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.handled !== "boolean") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ handled_at: body.handled ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
