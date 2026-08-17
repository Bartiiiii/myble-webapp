import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { accountApiStatus } from "@/lib/accountAuth";
import { SLUG_RE } from "@/lib/designSlug";

// PATCH { name } — rename. DELETE — remove. Both scope the query to
// `slug = ? AND user_email = ?`, so ownership is enforced by the WHERE clause
// itself, not just by which routes the app happens to expose.

export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  const { slug } = await ctx.params;
  if (!SLUG_RE.test(slug)) return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("designs")
    .update({ name })
    .eq("slug", slug)
    .eq("user_email", email)
    .select("slug")
    .maybeSingle();

  if (error) {
    console.error("[account/designs] rename failed", { error: error.message });
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  const { slug } = await ctx.params;
  if (!SLUG_RE.test(slug)) return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("designs")
    .delete()
    .eq("slug", slug)
    .eq("user_email", email)
    .select("slug")
    .maybeSingle();

  if (error) {
    console.error("[account/designs] delete failed", { error: error.message });
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
