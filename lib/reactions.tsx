"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// 🔥 reactions — shared client state for the Design Library.
//
// Server counts come from /api/reactions. Which designs *this browser* has
// reacted to lives in localStorage: no accounts yet, so this is what stops one
// person tapping a design ten times, and it survives reloads so the button
// shows the right state.
//
// `reacted` and `counts` live in ONE state object, updated by a single
// setState call. They used to be two separate useState hooks with a shared
// mutable `delta` variable threading updates between them — but React
// processes each hook's queued updater during its own render pass, in hook
// declaration order, not in call order. That meant the count's updater could
// run before the reacted-set's updater had actually flipped `delta`, so the
// count only ever incremented, no matter which direction the toggle went.
// One state object removes the ordering dependency entirely.
//
// Updates are optimistic — the count moves on tap and is reconciled with the
// server's authoritative value on response. If the request fails (or the
// migration hasn't been run yet) the local state still holds, so the feature
// degrades to per-browser rather than breaking.

const STORAGE_KEY = "myble.reactions.v1";

function readReacted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeReacted(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

interface ReactionsState {
  counts: Record<string, number>;
  reacted: Set<string>;
}

interface ReactionsValue extends ReactionsState {
  toggle: (id: string) => void;
}

const ReactionsContext = createContext<ReactionsValue | null>(null);

export function ReactionsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ReactionsState>({ counts: {}, reacted: new Set() });
  // Designs with a toggle currently in flight — a click while pending is
  // ignored, which is what actually stops rapid-click spam (the state fix
  // above makes single toggles correct; this stops a burst of clicks each
  // firing their own request before the first one's reconciliation lands).
  const pendingRef = useRef<Set<string>>(new Set());

  // Hydrate after mount so the server render stays deterministic.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => ({ ...prev, reacted: readReacted() }));

    let cancelled = false;
    fetch("/api/reactions")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body?.counts) {
          setState((prev) => ({ ...prev, counts: body.counts as Record<string, number> }));
        }
      })
      .catch(() => {
        /* offline or table not ready — local-only mode */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((id: string) => {
    if (pendingRef.current.has(id)) return; // a request for this design is already in flight
    pendingRef.current.add(id);

    let delta: 1 | -1 = 1;
    setState((prev) => {
      const nextReacted = new Set(prev.reacted);
      if (nextReacted.has(id)) {
        nextReacted.delete(id);
        delta = -1;
      } else {
        nextReacted.add(id);
        delta = 1;
      }
      writeReacted(nextReacted);
      return {
        reacted: nextReacted,
        counts: { ...prev.counts, [id]: Math.max(0, (prev.counts[id] ?? 0) + delta) },
      };
    });

    fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, delta }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        // Reconcile with the server's authoritative count.
        if (body?.ok && typeof body.count === "number") {
          setState((prev) => ({ ...prev, counts: { ...prev.counts, [id]: body.count as number } }));
        }
      })
      .catch(() => {
        /* keep the optimistic value — local-only mode */
      })
      .finally(() => {
        pendingRef.current.delete(id);
      });
  }, []);

  const value = useMemo(
    () => ({ counts: state.counts, reacted: state.reacted, toggle }),
    [state, toggle],
  );

  return <ReactionsContext.Provider value={value}>{children}</ReactionsContext.Provider>;
}

export function useReactions(): ReactionsValue {
  const ctx = useContext(ReactionsContext);
  // Fall back to inert state so a card can render outside a provider.
  return ctx ?? { counts: {}, reacted: new Set<string>(), toggle: () => {} };
}
