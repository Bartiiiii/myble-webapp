// Undo / redo for the configurator.
//
// The tricky part is not the stack, it is what counts as one step. A drag calls
// setDesign on every pointer move, and a slider on every pixel, so recording
// each call would bury a single gesture under a hundred undo steps. Changes
// that land within COALESCE_MS of each other are therefore folded into the step
// already in progress: a drag, a slider sweep and a held control each collapse
// to the one edit the user thinks they made, while separate actions — seconds
// apart in practice — stay separate.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/** Steps kept. Designs are small, but an unbounded stack is still a leak. */
const LIMIT = 60;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/**
 * Record a new value. `coalesce` folds it into the step in progress instead of
 * opening another one — see the note at the top about gestures.
 */
export function commit<T>(h: History<T>, next: T, coalesce: boolean): History<T> {
  if (Object.is(next, h.present)) return h;
  if (coalesce && h.past.length > 0) return { ...h, present: next, future: [] };
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  const previous = h.past[h.past.length - 1];
  if (previous === undefined) return h;
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future;
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: rest };
}

/** Drop the whole stack and start again from `present` — for loading a design
 *  rather than editing one, where "undo" back to a blank default is nonsense. */
export function resetHistory<T>(present: T): History<T> {
  return initHistory(present);
}

export const canUndo = <T,>(h: History<T>) => h.past.length > 0;
export const canRedo = <T,>(h: History<T>) => h.future.length > 0;

// ── React binding ───────────────────────────────────────────────────────────

const COALESCE_MS = 400;

export interface Undoable<T> {
  value: T;
  /** Drop-in for a useState setter; folds rapid changes into one step. */
  set: (update: T | ((current: T) => T)) => void;
  /** Replace the value and forget the history (loading, not editing). */
  reset: (value: T) => void;
  /**
   * Mark a continuous gesture. Everything between `true` and `false` becomes a
   * single step however long it runs — a drag the user pauses halfway through
   * is still one drag, which a timer alone cannot know.
   */
  setGesture: (active: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoable<T>(initial: T): Undoable<T> {
  const [history, setHistory] = useState<History<T>>(() => initHistory(initial));
  const lastEditAt = useRef(0);
  const inGesture = useRef(false);
  /** Whether this gesture has already opened its step. */
  const gestureOpened = useRef(false);

  const set = useCallback((update: T | ((current: T) => T)) => {
    // Decide the timing out here: a state updater can run more than once for
    // one call, and the clock must not advance when it does.
    const now = Date.now();
    let coalesce: boolean;
    if (inGesture.current) {
      // First change of the gesture opens the step, the rest fold into it.
      coalesce = gestureOpened.current;
      gestureOpened.current = true;
    } else {
      coalesce = now - lastEditAt.current < COALESCE_MS;
    }
    lastEditAt.current = now;
    setHistory((h) => {
      const next = typeof update === "function" ? (update as (c: T) => T)(h.present) : update;
      return commit(h, next, coalesce);
    });
  }, []);

  const setGesture = useCallback((active: boolean) => {
    inGesture.current = active;
    gestureOpened.current = false;
    // A fresh gesture, and whatever follows one, each start their own step.
    if (!active) lastEditAt.current = 0;
  }, []);

  const reset = useCallback((value: T) => {
    lastEditAt.current = 0;
    setHistory(resetHistory(value));
  }, []);

  // Stepping through history is not itself an edit, and the next edit must open
  // a step of its own rather than folding into the one just restored.
  const stepBack = useCallback(() => {
    lastEditAt.current = 0;
    setHistory(undo);
  }, []);
  const stepForward = useCallback(() => {
    lastEditAt.current = 0;
    setHistory(redo);
  }, []);

  return useMemo(
    () => ({
      value: history.present,
      set,
      reset,
      setGesture,
      undo: stepBack,
      redo: stepForward,
      canUndo: canUndo(history),
      canRedo: canRedo(history),
    }),
    [history, set, reset, setGesture, stepBack, stepForward],
  );
}

/**
 * Cmd+Z / Cmd+Shift+Z on a Mac, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y on Windows.
 * A field the user is typing in keeps its own undo stack, so we stay out of it.
 */
export function useUndoRedoKeys(undoFn: () => void, redoFn: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const typing =
        tag === "TEXTAREA" ||
        el?.isContentEditable === true ||
        (tag === "INPUT" &&
          !["range", "checkbox", "radio", "button", "submit", "color"].includes(
            (el as HTMLInputElement).type,
          ));
      if (typing) return;

      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redoFn();
        else undoFn();
      } else if (key === "y") {
        e.preventDefault();
        redoFn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoFn, redoFn]);
}
