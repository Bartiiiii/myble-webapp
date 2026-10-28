"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useState } from "react";
import type { Design } from "../../lib/model";
import type { RoomId } from "../../lib/rooms";
import { useIsNarrow } from "../../lib/useIsNarrow";

const ShelfViewer = dynamic(() => import("../ShelfViewer"), { ssr: false });

/** The warm niche stage tone every library surface shares. */
export const WALL = "#ece7df";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Mounts the WebGL viewer only while the card is near the viewport, so a page
 * of spinning models never holds more than a handful of GL contexts at once.
 *
 * A ref callback rather than an effect: it is handed the node at commit time,
 * so there is no ref.current read and no state set from inside an effect. The
 * returned cleanup runs when the node detaches (React 19).
 */
export function LazyStage({
  design,
  height = "100%",
  fit,
  reduced = false,
  room,
}: {
  design: Design;
  /** Canvas height; the default fills the card the stage sits in. */
  height?: number | string;
  fit?: number;
  reduced?: boolean;
  /** Show the piece standing in this furnished room. */
  room?: RoomId;
}) {
  const [visible, setVisible] = useState(false);
  const narrow = useIsNarrow();

  const observe = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true); // no observer support: just render it
      return;
    }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "300px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={observe} className="flex h-full w-full items-center justify-center">
      {visible && (
        <ShelfViewer
          design={design}
          background={WALL}
          height={height}
          interactive={false}
          autoRotate={!reduced}
          lite
          fit={fit ?? (narrow ? 0.78 : 1.1)}
          room={room}
        />
      )}
    </div>
  );
}
