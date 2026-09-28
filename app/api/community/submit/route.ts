import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { accountApiStatus } from "@/lib/accountAuth";
import { ensureProfile, MAX_TITLE } from "@/lib/community";
import { isDesignShaped, makeSlug, MAX_DESIGN_BYTES, SLUG_RE } from "@/lib/designSlug";
import { CATEGORIES } from "@/lib/library";

// ─────────────────────────────────────────────────────────────────────────────
// "Share with the community" from the configurator.
//
// POST { design, locale, title, note?, category, categoryCustom?, slug? } → { ok, slug, status }
//
// `categoryCustom` only counts with category "other": the designer's own name
// for a type the list doesn't have yet.
//
// Nothing here goes live. A submission lands as share_status = 'pending' and
// waits for backstage → Designs to approve it; only then does it appear in the
// public library. The designer sees it meanwhile in My Account → My Designs,
// badged "Shared · pending review", which is the whole point of the pending
// state: they know it was received and that a human still has to look.
//
// Re-submitting a design that is already published changes nothing — an
// approved piece can't be edited out from under the approval.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.id).filter((id) => id !== "all"));
const MAX_NOTE = 280;
const MAX_CATEGORY_CUSTOM = 40;

export async function POST(req: Request) {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  let body: {
    design?: unknown;
    locale?: string;
    title?: unknown;
    note?: unknown;
    category?: unknown;
    categoryCustom?: unknown;
    slug?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const design = body.design;
  if (!isDesignShaped(design) || JSON.stringify(design).length > MAX_DESIGN_BYTES) {
    return NextResponse.json({ ok: false, error: "invalid_design" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : "";
  if (title.length < 2) return NextResponse.json({ ok: false, error: "invalid_title" }, { status: 400 });

  const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) || null : null;
  const category = typeof body.category === "string" && VALID_CATEGORIES.has(body.category as never) ? body.category : "shelves";
  const categoryCustom =
    category === "other" && typeof body.categoryCustom === "string"
      ? body.categoryCustom.trim().slice(0, MAX_CATEGORY_CUSTOM) || null
      : null;
  const locale = body.locale === "en" ? "en" : "cs";
  const claimSlug = typeof body.slug === "string" && SLUG_RE.test(body.slug) ? body.slug : null;

  try {
    // Make sure the designer has a profile, so the card can credit them the
    // moment it is approved.
    const session = await getServerSession(authOptions);
    await ensureProfile({ email, name: session?.user?.name ?? null, image: session?.user?.image ?? null });

    const supabase = createAdminClient();
    const submission = {
      design,
      locale,
      title,
      note,
      category,
      category_custom: categoryCustom,
      user_email: email,
      share_status: "pending" as const,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      review_note: null,
    };

    if (claimSlug) {
      const { data: existing } = await supabase
        .from("designs")
        .select("slug,user_email,share_status")
        .eq("slug", claimSlug)
        .maybeSingle();

      // Only the owner (or the anonymous share link's first claimer) may
      // resubmit an existing row; anything else falls through to a new one.
      if (existing && (!existing.user_email || existing.user_email === email)) {
        if (existing.share_status === "published") {
          return NextResponse.json({ ok: true, slug: claimSlug, status: "published" });
        }
        const { error } = await supabase.from("designs").update(submission).eq("slug", claimSlug);
        if (error) {
          console.error("[community/submit] update failed", { error: error.message });
          return NextResponse.json({ ok: false, error: "submit_failed" }, { status: 500 });
        }
        return NextResponse.json({ ok: true, slug: claimSlug, status: "pending" });
      }
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      const slug = makeSlug();
      const { error } = await supabase.from("designs").insert({ slug, ...submission });
      if (!error) return NextResponse.json({ ok: true, slug, status: "pending" });
      if (error.code !== "23505") {
        console.error("[community/submit] insert failed", { error: error.message });
        return NextResponse.json({ ok: false, error: "submit_failed" }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: false, error: "submit_failed" }, { status: 500 });
  } catch (err) {
    console.error("[community/submit] threw", { err });
    return NextResponse.json({ ok: false, error: "submit_failed" }, { status: 500 });
  }
}
