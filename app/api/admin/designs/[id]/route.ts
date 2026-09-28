import { NextResponse } from "next/server";
import { backstageApiStatus } from "@/lib/adminAuth";
import { createAdminClient } from "@/utils/supabase/admin";

// Backstage review of one community submission.
//
// PATCH { action: 'approve' | 'reject' | 'unpublish', note? } → { ok, status }
//
// approve   → published (live in the Design Library)
// reject    → rejected  (stays in the designer's account, never public)
// unpublish → pending   (pull a live piece back for another look)
//
// The gate is the same double-lock as every other backstage route: Google
// owner e-mail + the backstage cookie (lib/adminAuth.ts).

const NEXT_STATUS = {
  approve: "published",
  reject: "rejected",
  unpublish: "pending",
} as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const status = await backstageApiStatus();
  if (status) return NextResponse.json({ ok: false }, { status });

  const { id } = await ctx.params;
  let body: { action?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!(action in NEXT_STATUS)) {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }
  const next = NEXT_STATUS[action as keyof typeof NEXT_STATUS];
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 280) || null : null;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("designs")
    .update({ share_status: next, reviewed_at: new Date().toISOString(), review_note: note })
    .eq("id", id);

  if (error) {
    console.error("[admin/designs] review failed", { id, action, error: error.message });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: next });
}
