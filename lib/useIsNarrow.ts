"use client";

import { useEffect, useState } from "react";

/**
 * True below Tailwind's `sm` breakpoint (640px).
 *
 * Design-library cards are far smaller on phones (two per row), so the 3D
 * previews need the camera pulled back to keep tall pieces fully in frame —
 * see the `fit` prop on <ShelfViewer>.
 *
 * Starts `false` and updates after mount so the server render stays
 * deterministic and hydration matches.
 */
export function useIsNarrow(breakpointPx = 640): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNarrow(mq.matches);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [breakpointPx]);

  return narrow;
}
