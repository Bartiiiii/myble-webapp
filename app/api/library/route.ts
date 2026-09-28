import { NextResponse } from "next/server";
import { fetchPublishedDesigns } from "@/lib/community";
import { communityItem } from "@/lib/library";

// GET → { ok, items }
//
// The community half of the Design Library: designs people shared and
// backstage approved, shaped as LibraryItems so /library and the homepage can
// concatenate them onto the curated array and treat both the same.
//
// Fails soft (empty list) when Supabase is unreachable or unmigrated — the
// curated library still renders.

export const dynamic = "force-dynamic";

export async function GET() {
  const designs = await fetchPublishedDesigns();
  return NextResponse.json({ ok: true, items: designs.map(communityItem) });
}
