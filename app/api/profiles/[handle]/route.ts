import { NextResponse } from "next/server";
import { accountApiStatus } from "@/lib/accountAuth";
import {
  fetchPublishedByEmail,
  followerCount,
  followingCount,
  getProfileByEmail,
  getProfileByHandle,
  isFollowing,
  toAuthor,
} from "@/lib/community";
import { communityItem, LIBRARY, type LibraryItem } from "@/lib/library";
import { CURATED_AUTHOR } from "@/lib/designers";

// ─────────────────────────────────────────────────────────────────────────────
// A public designer profile: /u/<handle>.
//
// GET → { ok, profile, followers, following, isFollowing, isSelf, items }
//
// `items` are LibraryItems, so the profile page reuses the very same card as
// /library. Two sources feed it:
//   • seeded house designers are credited with curated pieces, which live in
//     code (lib/designers.ts), not in the database;
//   • everyone else shows the designs backstage has published.
//
// Only published work is ever returned — a private or pending design is
// visible to its owner in My Account, never here.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  const profile = await getProfileByHandle(handle.toLowerCase());
  if (!profile) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const curated: LibraryItem[] = profile.is_seed
    ? LIBRARY.filter((item) => CURATED_AUTHOR[item.id] === profile.handle)
    : [];
  const shared = profile.email ? await fetchPublishedByEmail(profile.email) : [];
  const items = [...curated, ...shared.map(communityItem)];

  const [followers, following] = await Promise.all([
    followerCount(profile.id),
    followingCount(profile.id),
  ]);

  // Viewer context: can they follow, and do they already?
  const { email: viewerEmail } = await accountApiStatus();
  const viewer = viewerEmail ? await getProfileByEmail(viewerEmail) : null;
  const isSelf = !!viewer && viewer.id === profile.id;

  return NextResponse.json({
    ok: true,
    profile: {
      ...toAuthor(profile),
      bio: profile.bio,
      joinedAt: profile.created_at,
    },
    followers,
    following,
    isFollowing: viewer && !isSelf ? await isFollowing(viewer.id, profile.id) : false,
    isSelf,
    signedIn: !!viewer,
    items,
  });
}
