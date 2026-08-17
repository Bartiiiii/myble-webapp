import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { accountApiStatus } from "@/lib/accountAuth";
import { fetchAccountDesigns } from "@/lib/accountData";
import { isDesignShaped, makeSlug, MAX_DESIGN_BYTES, SLUG_RE } from "@/lib/designSlug";

// ─────────────────────────────────────────────────────────────────────────────
// My Account → My Designs.
//
// POST { design, locale, name?, slug? } → { ok, slug }
//   - slug given + a row with that slug exists → claims it (sets user_email,
//     name on the SAME row), so saving a design you reached via a share link
//     doesn't create a duplicate.
//   - otherwise inserts a new row, same as the anonymous /api/designs POST,
//     but stamped with the caller's e-mail from the start.
// GET → { ok, designs }  — this account's saved designs, newest first.
//
// Identity always comes from the session (accountApiStatus), never the
// request body — a client cannot save/list under another e-mail.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  let body: { design?: unknown; locale?: string; name?: string; slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const design = body?.design;
  if (!isDesignShaped(design) || JSON.stringify(design).length > MAX_DESIGN_BYTES) {
    return NextResponse.json({ ok: false, error: "invalid_design" }, { status: 400 });
  }
  const locale = body?.locale === "en" ? "en" : "cs";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) || null : null;
  const claimSlug = typeof body?.slug === "string" && SLUG_RE.test(body.slug) ? body.slug : null;

  try {
    const supabase = createAdminClient();

    if (claimSlug) {
      const { data, error } = await supabase
        .from("designs")
        .update({ design, locale, name, user_email: email })
        .eq("slug", claimSlug)
        .select("slug")
        .maybeSingle();
      if (error) {
        console.error("[account/designs] claim failed", { error: error.message });
        return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
      }
      if (data) return NextResponse.json({ ok: true, slug: data.slug });
      // Slug didn't resolve to an existing row — fall through to a fresh insert.
    }

    // Retry once on the (astronomically unlikely) slug collision.
    for (let attempt = 0; attempt < 2; attempt++) {
      const slug = makeSlug();
      const { error } = await supabase
        .from("designs")
        .insert({ slug, design, locale, name, user_email: email });
      if (!error) return NextResponse.json({ ok: true, slug });
      if (error.code !== "23505") {
        console.error("[account/designs] persist failed", { error: error.message });
        return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  } catch (err) {
    console.error("[account/designs] persist threw", { err });
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }
}

export async function GET() {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  try {
    const designs = await fetchAccountDesigns(email);
    return NextResponse.json({ ok: true, designs });
  } catch (err) {
    console.error("[account/designs] list threw", { err });
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }
}
