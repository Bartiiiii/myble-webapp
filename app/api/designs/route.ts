import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Shareable design snapshots.
//
// POST { design, locale } → { slug }   — save a full Design JSON, get share slug
// GET  ?slug=<slug>       → { design } — load it back (/design?d=<slug>)
//
// The `designs` table is RLS deny-all; both directions go through the
// service-role client here. Slugs are 8 chars of base62 from crypto randomness
// (~47 bits), unguessable enough for share links that carry no personal data —
// a design is just geometry + colour.
// ─────────────────────────────────────────────────────────────────────────────

const SLUG_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SLUG_RE = /^[A-Za-z0-9]{8}$/;
const MAX_DESIGN_BYTES = 100_000;

function makeSlug(): string {
  const bytes = randomBytes(8);
  let slug = "";
  for (const b of bytes) slug += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
  return slug;
}

function isDesignShaped(v: unknown): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as { parts?: unknown }).parts) &&
    typeof (v as { outerCm?: unknown }).outerCm === "object"
  );
}

export async function POST(req: Request) {
  let body: { design?: unknown; locale?: string };
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

  try {
    const supabase = createAdminClient();
    // Retry once on the (astronomically unlikely) slug collision.
    for (let attempt = 0; attempt < 2; attempt++) {
      const slug = makeSlug();
      const { error } = await supabase.from("designs").insert({ slug, design, locale });
      if (!error) return NextResponse.json({ ok: true, slug });
      if (error.code !== "23505") {
        console.error("[designs] persist failed", { error: error.message });
        return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  } catch (err) {
    console.error("[designs] persist threw", { err });
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("designs").select("design").eq("slug", slug).maybeSingle();
    if (error) {
      console.error("[designs] read failed", { slug, error: error.message });
      return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, design: data.design });
  } catch (err) {
    console.error("[designs] read threw", { slug, err });
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }
}
