import { NextResponse } from "next/server";
import { fetchPublishedDesigns } from "@/lib/community";
import { fetchCuratedOverrides } from "@/lib/curatedOverrides";
import { communityItem } from "@/lib/library";

// GET → { ok, items, curated }
//
// The live half of the Design Library:
//   items   — designs people shared and backstage approved, shaped as
//             LibraryItems so /library and the homepage can concatenate them
//             onto the curated array and treat both the same.
//   curated — { <curated id>: Design } for house designs backstage has edited
//             since the last deploy; laid over the versions in lib/library.ts.
//
// Fails soft (empty list / map) when Supabase is unreachable or unmigrated —
// the curated library still renders.

export const dynamic = "force-dynamic";

export async function GET() {
  const [designs, overrides] = await Promise.all([fetchPublishedDesigns(), fetchCuratedOverrides()]);
  const curated = Object.fromEntries(Object.entries(overrides).map(([id, o]) => [id, o.design]));
  return NextResponse.json({ ok: true, items: designs.map(communityItem), curated });
}
