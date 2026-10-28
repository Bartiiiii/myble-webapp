"use client";

import { useEffect, useMemo, useState } from "react";
import type { Design } from "./model";
import { LIBRARY, type LibraryItem, withCuratedOverrides } from "./library";

/**
 * Everything browsable in the Design Library: the curated pieces (compiled in,
 * so they render on first paint) plus the community designs backstage has
 * published (fetched, since they change without a deploy). Curated pieces
 * backstage has edited since the last deploy swap to their published version
 * once the fetch lands.
 *
 * Curated stay first so ties in the heat sort keep the familiar order; the
 * 🔥 counts decide everything above that.
 */
export function useLibraryPool(): { pool: LibraryItem[]; curated: LibraryItem[]; loadedCommunity: boolean } {
  const [community, setCommunity] = useState<LibraryItem[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Design> | null>(null);
  const [loadedCommunity, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/library")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        if (body?.ok && Array.isArray(body.items)) setCommunity(body.items as LibraryItem[]);
        if (body?.ok && body.curated && typeof body.curated === "object") {
          setOverrides(body.curated as Record<string, Design>);
        }
        setLoaded(true);
      })
      .catch(() => {
        /* curated-only is a perfectly good library */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const curated = useMemo(() => (overrides ? withCuratedOverrides(overrides) : LIBRARY), [overrides]);
  const pool = useMemo(() => [...curated, ...community], [curated, community]);
  return { pool, curated, loadedCommunity };
}
