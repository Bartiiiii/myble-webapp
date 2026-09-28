"use client";

import { useEffect, useMemo, useState } from "react";
import { LIBRARY, type LibraryItem } from "./library";

/**
 * Everything browsable in the Design Library: the curated pieces (compiled in,
 * so they render on first paint) plus the community designs backstage has
 * published (fetched, since they change without a deploy).
 *
 * Curated stay first so ties in the heat sort keep the familiar order; the
 * 🔥 counts decide everything above that.
 */
export function useLibraryPool(): { pool: LibraryItem[]; loadedCommunity: boolean } {
  const [community, setCommunity] = useState<LibraryItem[]>([]);
  const [loadedCommunity, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/library")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        if (body?.ok && Array.isArray(body.items)) setCommunity(body.items as LibraryItem[]);
        setLoaded(true);
      })
      .catch(() => {
        /* curated-only is a perfectly good library */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pool = useMemo(() => [...LIBRARY, ...community], [community]);
  return { pool, loadedCommunity };
}
