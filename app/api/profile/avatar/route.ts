import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { accountApiStatus } from "@/lib/accountAuth";
import { getProfileByEmail } from "@/lib/community";

// ─────────────────────────────────────────────────────────────────────────────
// Avatar upload: a photo from the device, or one taken with the camera.
//
// POST (multipart form-data, field `file`) → { ok, avatarUrl }
//
// The browser has already cropped this to a square and resized it to 256 px
// (see components/account/ProfileEditor.tsx), so what arrives is a few tens of
// kilobytes — the limits below are a backstop against a hand-rolled request,
// not the normal path.
//
// Stored in the public `avatars` bucket under the profile's own id, so a new
// upload replaces the old file rather than piling up orphans. The bucket has
// no RLS policies, exactly like every table here: only this route's
// service-role client can write, while reads are public because an avatar is
// drawn on public pages.
//
// The path is stable, so the URL carries a ?v= stamp; without it a replaced
// photo would sit behind the CDN's cache of the previous one.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  if (!file) return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ ok: false, error: "unsupported_type" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });

  try {
    const profile = await getProfileByEmail(email);
    if (!profile) return NextResponse.json({ ok: false, error: "no_profile" }, { status: 404 });

    const supabase = createAdminClient();
    const path = `${profile.id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("[profile/avatar] upload failed", { error: uploadError.message });
      return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

    // Persist immediately: the photo IS the change, and saving it here means a
    // half-finished profile edit still leaves the person with the face they
    // just chose.
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", profile.id);
    if (saveError) {
      console.error("[profile/avatar] save failed", { error: saveError.message });
      return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, avatarUrl });
  } catch (err) {
    console.error("[profile/avatar] threw", { err });
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
  }
}
