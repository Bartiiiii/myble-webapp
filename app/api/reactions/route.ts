import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { LIBRARY_IDS } from "@/lib/library";

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 reactions on Design Library pieces.
//
// GET            → { ok, counts: { [designId]: number } }
// POST { id, delta: 1 | -1 } → { ok, count }
//
// The `design_reactions` table is RLS deny-all; both directions use the
// service-role client. Design ids are validated against the curated LIBRARY
// allowlist, so a caller can neither create arbitrary rows nor inflate a
// counter for something that isn't a real design.
//
// Fail-soft by design: if the table doesn't exist yet (migration 0005 not run)
// or Supabase env is missing, GET returns empty counts and POST reports
// ok:false rather than throwing. The UI then falls back to local-only state,
// so the feature degrades instead of breaking the page.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

const ALLOWED = new Set(LIBRARY_IDS);

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("design_reactions")
      .select("design_id, fire_count");

    if (error) {
      console.error("[reactions] read failed", { error: error.message });
      return NextResponse.json({ ok: false, counts: {} });
    }

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      // Drop rows for designs that have since left the curated library.
      if (ALLOWED.has(row.design_id)) counts[row.design_id] = row.fire_count;
    }
    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    console.error("[reactions] read threw", { err });
    return NextResponse.json({ ok: false, counts: {} });
  }
}

export async function POST(req: Request) {
  let body: { id?: unknown; delta?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!ALLOWED.has(id)) {
    return NextResponse.json({ ok: false, error: "unknown_design" }, { status: 400 });
  }
  // Only ±1 — the client toggles, it never submits a magnitude.
  const delta = body.delta === -1 ? -1 : 1;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("bump_design_fire", {
      p_design_id: id,
      p_delta: delta,
    });

    if (error) {
      console.error("[reactions] bump failed", { id, delta, error: error.message });
      return NextResponse.json({ ok: false, error: "bump_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: typeof data === "number" ? data : 0 });
  } catch (err) {
    console.error("[reactions] bump threw", { id, delta, err });
    return NextResponse.json({ ok: false, error: "bump_failed" }, { status: 500 });
  }
}
