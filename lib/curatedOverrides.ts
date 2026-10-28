import { createAdminClient } from "@/utils/supabase/admin";
import { isPartsDesign } from "@/lib/design";
import { LIBRARY_IDS } from "@/lib/library";
import type { Design } from "@/lib/model";

// Edited versions of the curated (house) library designs, published from
// backstage (see supabase/migrations/0009_curated_overrides.sql).
//
// Server-only. Public reads fail SOFT to "no overrides", so the library falls
// back to the versions compiled into lib/library.ts. Backstage writes throw.

export interface CuratedOverride {
  design: Design;
  version: number;
  updatedAt: string;
}

const CURATED = new Set(LIBRARY_IDS);

export function isCuratedId(id: string): boolean {
  return CURATED.has(id);
}

/** Every published override, keyed by curated id. Fails soft. */
export async function fetchCuratedOverrides(): Promise<Record<string, CuratedOverride>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("curated_overrides").select("id, design, version, updated_at");
    if (error) return {};
    const out: Record<string, CuratedOverride> = {};
    for (const row of data ?? []) {
      if (!CURATED.has(row.id) || !isPartsDesign(row.design)) continue;
      out[row.id] = { design: row.design as Design, version: row.version, updatedAt: row.updated_at };
    }
    return out;
  } catch {
    return {};
  }
}

/** Publish a new version of one curated design. Returns the new version number. */
export async function publishCuratedOverride(id: string, design: Design): Promise<number> {
  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase
    .from("curated_overrides")
    .select("version")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  const version = (existing?.version ?? 0) + 1;
  const { error } = await supabase
    .from("curated_overrides")
    .upsert({ id, design, version, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return version;
}

/** Drop the override, so the piece goes back to the version in code. */
export async function revertCuratedOverride(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("curated_overrides").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
