import { NextResponse } from "next/server";
import { accountApiStatus } from "@/lib/accountAuth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
  ensureProfile,
  followerCount,
  followingCount,
  getProfileByEmail,
  HANDLE_RE,
  MAX_BIO,
  MAX_NAME,
  saveProfile,
  slugifyHandle,
} from "@/lib/community";

// ─────────────────────────────────────────────────────────────────────────────
// The signed-in person's own profile.
//
// GET   → { ok, profile, needsSetup, followers, following }
//         Creates the row on first ever call, which is what puts every Google
//         sign-in into backstage → Users. `needsSetup` is true until they have
//         confirmed their name and avatar once (see /welcome).
// PATCH { displayName, handle, avatarUrl, avatarColor, bio } → { ok, profile }
//         Also flips needsSetup off, since saving IS the confirmation.
//
// Identity comes from the session; the body only ever carries presentation.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET() {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  const session = await getServerSession(authOptions);

  try {
    const profile = await ensureProfile({
      email,
      name: session?.user?.name ?? null,
      image: session?.user?.image ?? null,
    });
    if (!profile) return NextResponse.json({ ok: false, error: "no_profile" }, { status: 500 });

    const [followers, following] = await Promise.all([
      followerCount(profile.id),
      followingCount(profile.id),
    ]);

    return NextResponse.json({
      ok: true,
      profile: {
        handle: profile.handle,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        avatarColor: profile.avatar_color,
        bio: profile.bio,
      },
      // What Google gave us, so /welcome can offer "use my Google photo".
      googleImage: session?.user?.image ?? null,
      googleName: session?.user?.name ?? null,
      needsSetup: profile.onboarded_at === null,
      followers,
      following,
    });
  } catch (err) {
    console.error("[profile] get threw", { err });
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  let body: { displayName?: unknown; handle?: unknown; avatarUrl?: unknown; avatarColor?: unknown; bio?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, MAX_NAME) : "";
  if (displayName.length < 2) {
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }

  // A handle the person typed must be valid; one we derive from their name is
  // sanitised instead, so a name of "Žofie Č." still yields something usable.
  const rawHandle = typeof body.handle === "string" ? body.handle.trim().toLowerCase() : "";
  const handle = rawHandle ? (HANDLE_RE.test(rawHandle) ? rawHandle : slugifyHandle(rawHandle)) : undefined;
  if (rawHandle && !handle) {
    return NextResponse.json({ ok: false, error: "invalid_handle" }, { status: 400 });
  }

  // An avatar is rendered on other people's pages, so the URL can only be one
  // of three things we put there ourselves: the Google photo from this
  // session, a file uploaded through /api/profile/avatar, or whatever is
  // already saved. Anything else the client sends falls back to initials.
  const sessionImage = (await getServerSession(authOptions))?.user?.image ?? null;
  const existing = await getProfileByEmail(email);
  const requested = typeof body.avatarUrl === "string" ? body.avatarUrl : null;
  const uploadPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/avatars/`;
  const trusted =
    !!requested &&
    (requested === sessionImage ||
      requested === existing?.avatar_url ||
      (uploadPrefix.length > "/storage/v1/object/public/avatars/".length && requested.startsWith(uploadPrefix)));
  const avatarUrl = trusted ? requested : null;

  const avatarColor = Number.isFinite(body.avatarColor) ? Number(body.avatarColor) : 0;
  const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, MAX_BIO) : undefined;

  try {
    const profile = await saveProfile(email, { displayName, handle, avatarUrl, avatarColor, bio });
    if (!profile) return NextResponse.json({ ok: false, error: "no_profile" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      profile: {
        handle: profile.handle,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        avatarColor: profile.avatar_color,
        bio: profile.bio,
      },
    });
  } catch (err) {
    console.error("[profile] patch threw", { err });
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }
}
