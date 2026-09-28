import { createAdminClient } from "@/utils/supabase/admin";
import { type Author, CURATED_AUTHOR } from "@/lib/designers";
import type { CommunityDesign } from "@/lib/library";
import type { Design } from "@/lib/model";

// ─────────────────────────────────────────────────────────────────────────────
// The community layer: profiles, the follower graph, and the designs people
// share into the public library.
//
// Server-only (service-role Supabase). Identity is the normalized session
// e-mail, exactly as in lib/accountData.ts — never a value from the request
// body, so a caller can't act as somebody else.
//
// Everything a public page calls fails SOFT: a missing table or missing
// Supabase env returns empty/null instead of throwing, so /library and /u/<h>
// still render the curated half of the world. Backstage reads throw, matching
// lib/backstageData.ts — there, silence would hide a real problem.
// ─────────────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string | null;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: number;
  bio: string | null;
  is_seed: boolean;
  onboarded_at: string | null;
  created_at: string;
  last_seen_at: string;
}

const PROFILE_COLS = "id,email,handle,display_name,avatar_url,avatar_color,bio,is_seed,onboarded_at,created_at,last_seen_at";

export const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{1,23}$/;
export const MAX_NAME = 40;
export const MAX_BIO = 160;
export const MAX_TITLE = 60;

/** The author shape the UI draws, from a profile row. */
export function toAuthor(p: Profile): Author {
  return {
    handle: p.handle,
    name: p.display_name,
    avatarUrl: p.avatar_url,
    avatarColor: p.avatar_color,
    seed: p.is_seed,
  };
}

/** A stand-in author for a design whose owner has no profile row (yet). */
export const ANON_AUTHOR: Author = {
  handle: "",
  name: "Myble customer",
  avatarUrl: null,
  avatarColor: 0,
  seed: false,
};

// ── Handles ──────────────────────────────────────────────────────────────────

/** "Tereza Malá" → "tereza-mala"; falls back to the e-mail's local part. */
export function slugifyHandle(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics: Dvořáková → Dvorakova
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
  return base.length >= 2 ? base : "";
}

/** The given handle, or the first free `handle-2`, `handle-3`, … variant. */
async function freeHandle(desired: string, exceptId?: string): Promise<string> {
  const supabase = createAdminClient();
  const base = desired || `myble-${Math.random().toString(36).slice(2, 8)}`;
  for (let n = 1; n < 60; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 20)}-${n}`;
    const { data } = await supabase.from("profiles").select("id").eq("handle", candidate).maybeSingle();
    if (!data || data.id === exceptId) return candidate;
  }
  return `myble-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Profiles ─────────────────────────────────────────────────────────────────

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("profiles").select(PROFILE_COLS).eq("email", email).maybeSingle();
    return (data as Profile | null) ?? null;
  } catch {
    return null;
  }
}

export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("profiles").select(PROFILE_COLS).eq("handle", handle).maybeSingle();
    return (data as Profile | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Create the profile on first sign-in, or touch `last_seen_at` on every later
 * one. The Google name/photo are only ever the DEFAULTS: once someone has
 * confirmed their profile (onboarded_at set), a later Google change never
 * overwrites what they chose.
 */
export async function ensureProfile(input: {
  email: string;
  name: string | null;
  image: string | null;
}): Promise<Profile | null> {
  const supabase = createAdminClient();
  const existing = await getProfileByEmail(input.email);

  if (existing) {
    const { data } = await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select(PROFILE_COLS)
      .maybeSingle();
    return (data as Profile | null) ?? existing;
  }

  const displayName = (input.name ?? input.email.split("@")[0] ?? "Myble designer").trim().slice(0, MAX_NAME);
  const handle = await freeHandle(slugifyHandle(displayName) || slugifyHandle(input.email.split("@")[0] ?? ""));
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      email: input.email,
      handle,
      display_name: displayName,
      avatar_url: input.image,
      avatar_color: handle.charCodeAt(0) % 8,
    })
    .select(PROFILE_COLS)
    .maybeSingle();

  if (error) {
    // A parallel first request may have won the race — read theirs back.
    if (error.code === "23505") return getProfileByEmail(input.email);
    throw new Error(`profile create failed: ${error.message}`);
  }
  return (data as Profile | null) ?? null;
}

/** Saves the first-run (or settings) profile edit and marks it confirmed. */
export async function saveProfile(
  email: string,
  patch: { displayName: string; handle?: string; avatarUrl: string | null; avatarColor: number; bio?: string | null },
): Promise<Profile | null> {
  const supabase = createAdminClient();
  const existing = await getProfileByEmail(email);
  if (!existing) return null;

  const desired = patch.handle && HANDLE_RE.test(patch.handle) ? patch.handle : existing.handle;
  const handle = desired === existing.handle ? existing.handle : await freeHandle(desired, existing.id);

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: patch.displayName.slice(0, MAX_NAME),
      handle,
      avatar_url: patch.avatarUrl,
      avatar_color: ((patch.avatarColor % 8) + 8) % 8,
      bio: patch.bio === undefined ? existing.bio : (patch.bio?.slice(0, MAX_BIO) || null),
      onboarded_at: existing.onboarded_at ?? new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select(PROFILE_COLS)
    .maybeSingle();

  if (error) throw new Error(`profile save failed: ${error.message}`);
  return (data as Profile | null) ?? null;
}

// ── Follows ──────────────────────────────────────────────────────────────────

export async function followerCount(profileId: string): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", profileId);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** How many people this profile follows. */
export async function followingCount(profileId: string): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", profileId);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/** Follow/unfollow, idempotent in both directions. Returns the new count. */
export async function setFollow(followerId: string, followingId: string, on: boolean): Promise<number> {
  const supabase = createAdminClient();
  if (on) {
    const { error } = await supabase.from("follows").insert({ follower_id: followerId, following_id: followingId });
    // 23505 = already following. Not an error from the caller's point of view.
    if (error && error.code !== "23505") throw new Error(`follow failed: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
    if (error) throw new Error(`unfollow failed: ${error.message}`);
  }
  return followerCount(followingId);
}

// ── Shared designs ───────────────────────────────────────────────────────────

export type ShareStatus = "private" | "pending" | "published" | "rejected";

export interface SharedDesignRow {
  id: string;
  slug: string;
  title: string | null;
  note: string | null;
  category: string | null;
  /** The designer's own type name when they picked "Other". */
  category_custom: string | null;
  design: Design;
  locale: string;
  user_email: string | null;
  share_status: ShareStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

const SHARED_COLS =
  "id,slug,title,note,category,category_custom,design,locale,user_email,share_status,submitted_at,reviewed_at,review_note,created_at";

/** Authors for a set of e-mails, in one round trip. */
async function authorsByEmail(emails: string[]): Promise<Map<string, Author>> {
  const map = new Map<string, Author>();
  const unique = [...new Set(emails.filter(Boolean))];
  if (unique.length === 0) return map;
  const supabase = createAdminClient();
  const { data } = await supabase.from("profiles").select(PROFILE_COLS).in("email", unique);
  for (const p of (data ?? []) as Profile[]) if (p.email) map.set(p.email, toAuthor(p));
  return map;
}

function toCommunityDesign(row: SharedDesignRow, authors: Map<string, Author>): CommunityDesign {
  return {
    slug: row.slug,
    title: row.title,
    note: row.note,
    category: row.category,
    design: row.design,
    createdAt: row.submitted_at ?? row.created_at,
    author: (row.user_email && authors.get(row.user_email)) || ANON_AUTHOR,
  };
}

/** Everything live in the public library, newest first. Fails soft. */
export async function fetchPublishedDesigns(limit = 60): Promise<CommunityDesign[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("designs")
      .select(SHARED_COLS)
      .eq("share_status", "published")
      .order("reviewed_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    const rows = (data ?? []) as SharedDesignRow[];
    const authors = await authorsByEmail(rows.map((r) => r.user_email ?? ""));
    return rows.map((r) => toCommunityDesign(r, authors));
  } catch {
    return [];
  }
}

/** One person's published pieces, for their profile page. Fails soft. */
export async function fetchPublishedByEmail(email: string): Promise<CommunityDesign[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("designs")
      .select(SHARED_COLS)
      .eq("share_status", "published")
      .eq("user_email", email)
      .order("reviewed_at", { ascending: false })
      .limit(60);
    if (error) return [];
    const rows = (data ?? []) as SharedDesignRow[];
    const authors = await authorsByEmail([email]);
    return rows.map((r) => toCommunityDesign(r, authors));
  } catch {
    return [];
  }
}

/** Slugs that are live in the library — the reaction allowlist beyond curated. */
export async function publishedSlugs(): Promise<Set<string>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("designs").select("slug").eq("share_status", "published");
    if (error) return new Set();
    return new Set((data ?? []).map((r) => (r as { slug: string }).slug));
  } catch {
    return new Set();
  }
}

/** Backstage: submissions in one state (or all of them), newest first. */
export async function fetchSubmissions(status?: ShareStatus): Promise<
  (SharedDesignRow & { author: Author | null })[]
> {
  const supabase = createAdminClient();
  let query = supabase
    .from("designs")
    .select(SHARED_COLS)
    .neq("share_status", "private")
    .order("submitted_at", { ascending: false })
    .limit(500);
  if (status) query = query.eq("share_status", status);

  const { data, error } = await query;
  if (error) throw new Error(`submissions query failed: ${error.message}`);
  const rows = (data ?? []) as SharedDesignRow[];
  const authors = await authorsByEmail(rows.map((r) => r.user_email ?? ""));
  return rows.map((r) => ({ ...r, author: (r.user_email && authors.get(r.user_email)) || null }));
}

/** Backstage: everyone who has ever signed in, plus the seeded designers. */
export async function fetchUsers(): Promise<
  (Profile & { followers: number; published: number; submitted: number })[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .order("last_seen_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`profiles query failed: ${error.message}`);
  const profiles = (data ?? []) as Profile[];

  const [{ data: follows }, { data: designs }] = await Promise.all([
    supabase.from("follows").select("following_id"),
    supabase.from("designs").select("user_email,share_status"),
  ]);

  const followers = new Map<string, number>();
  for (const f of (follows ?? []) as { following_id: string }[]) {
    followers.set(f.following_id, (followers.get(f.following_id) ?? 0) + 1);
  }
  const published = new Map<string, number>();
  const submitted = new Map<string, number>();
  for (const d of (designs ?? []) as { user_email: string | null; share_status: string }[]) {
    if (!d.user_email) continue;
    if (d.share_status === "published") published.set(d.user_email, (published.get(d.user_email) ?? 0) + 1);
    if (d.share_status === "pending") submitted.set(d.user_email, (submitted.get(d.user_email) ?? 0) + 1);
  }

  // Seeded designers own curated pieces, which live in code rather than in the
  // designs table — credit those here so the column isn't misleadingly 0.
  const curatedBySeed = new Map<string, number>();
  for (const handle of Object.values(CURATED_AUTHOR)) {
    curatedBySeed.set(handle, (curatedBySeed.get(handle) ?? 0) + 1);
  }

  return profiles.map((p) => ({
    ...p,
    followers: followers.get(p.id) ?? 0,
    published: (p.email ? published.get(p.email) ?? 0 : 0) + (curatedBySeed.get(p.handle) ?? 0),
    submitted: p.email ? submitted.get(p.email) ?? 0 : 0,
  }));
}
