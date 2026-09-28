"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// 🔥 reactions — shared client state for the Design Library.
//
// The server is the only authority here, for both halves of the state:
//   • `counts` — count(*) over the design_fires ledger.
//   • `reacted` — the ids THIS person has fired, read back from the same
//     ledger by their session e-mail or their httpOnly visitor cookie.
//
// That second point is the fix for the counter that "went up and up when you
// spam it". This module used to keep the reacted-set in localStorage and send
// the server a ±1: two sources of truth, and the browser owned the one that
// decided the direction. Now a tap sends the STATE it wants ({ id, on }) and
// the database's (design_id, reactor_key) primary key makes a repeat a no-op.
// Nothing on the client can inflate a count any more, so there is no local
// bookkeeping left to get out of step.
//
// Taps are still optimistic so the UI feels instant, and are reconciled with
// the server's number on response. A tap while a request for that design is
// in flight is ignored — the ledger would shrug it off anyway, but this keeps
// the visible number from bouncing.

interface ReactionsState {
  counts: Record<string, number>;
  reacted: Set<string>;
}

interface ReactionsValue extends ReactionsState {
  toggle: (id: string) => void;
  /** True once the server's state has landed (before that, nothing is "off"). */
  ready: boolean;
}

const ReactionsContext = createContext<ReactionsValue | null>(null);

export function ReactionsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ReactionsState>({ counts: {}, reacted: new Set() });
  const [ready, setReady] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reactions")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setState({
          counts: (body.counts ?? {}) as Record<string, number>,
          reacted: new Set<string>(Array.isArray(body.mine) ? body.mine : []),
        });
        setReady(true);
      })
      .catch(() => {
        /* offline or not migrated yet — counts stay at zero */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((id: string) => {
    if (pendingRef.current.has(id)) return; // one request per design at a time
    pendingRef.current.add(id);

    let on = true;
    setState((prev) => {
      const reacted = new Set(prev.reacted);
      on = !reacted.has(id);
      if (on) reacted.add(id);
      else reacted.delete(id);
      return {
        reacted,
        counts: { ...prev.counts, [id]: Math.max(0, (prev.counts[id] ?? 0) + (on ? 1 : -1)) },
      };
    });

    fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, on }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        // Reconcile with the server: its count and its view of my own state.
        if (!body?.ok || typeof body.count !== "number") return;
        setState((prev) => {
          const reacted = new Set(prev.reacted);
          if (body.on) reacted.add(id);
          else reacted.delete(id);
          return { reacted, counts: { ...prev.counts, [id]: body.count as number } };
        });
      })
      .catch(() => {
        /* keep the optimistic value; the next load re-reads the truth */
      })
      .finally(() => {
        pendingRef.current.delete(id);
      });
  }, []);

  const value = useMemo(
    () => ({ counts: state.counts, reacted: state.reacted, toggle, ready }),
    [state, toggle, ready],
  );

  return <ReactionsContext.Provider value={value}>{children}</ReactionsContext.Provider>;
}

export function useReactions(): ReactionsValue {
  const ctx = useContext(ReactionsContext);
  // Fall back to inert state so a card can render outside a provider.
  return ctx ?? { counts: {}, reacted: new Set<string>(), toggle: () => {}, ready: false };
}
