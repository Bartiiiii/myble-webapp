import { describe, it, expect } from "vitest";
import { canRedo, canUndo, commit, initHistory, redo, undo } from "./history";

const start = initHistory("a");

describe("history", () => {
  it("steps back and forward through separate edits", () => {
    let h = commit(start, "b", false);
    h = commit(h, "c", false);
    expect(h.present).toBe("c");

    h = undo(h);
    expect(h.present).toBe("b");
    h = undo(h);
    expect(h.present).toBe("a");
    expect(canUndo(h)).toBe(false);

    h = redo(h);
    expect(h.present).toBe("b");
    h = redo(h);
    expect(h.present).toBe("c");
    expect(canRedo(h)).toBe(false);
  });

  it("folds a gesture's many changes into one step", () => {
    // What a drag looks like: one edit, then a stream of coalesced updates.
    let h = commit(start, "drag-1", false);
    for (let i = 2; i <= 100; i++) h = commit(h, `drag-${i}`, true);
    expect(h.present).toBe("drag-100");
    // One undo takes the whole gesture back, not one pointer move of it.
    expect(undo(h).present).toBe("a");
  });

  it("never coalesces the very first edit away", () => {
    // With nothing behind it there is no step to fold into, so it opens one —
    // otherwise the opening state would be unreachable.
    const h = commit(start, "b", true);
    expect(undo(h).present).toBe("a");
  });

  it("drops the redo branch once you edit after undoing", () => {
    let h = commit(commit(start, "b", false), "c", false);
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = commit(h, "d", false);
    expect(canRedo(h)).toBe(false);
    expect(h.present).toBe("d");
  });

  it("ignores a change that changes nothing", () => {
    const h = commit(start, "a", false);
    expect(h).toBe(start);
  });

  it("does nothing at either end of the stack", () => {
    expect(undo(start)).toBe(start);
    expect(redo(start)).toBe(start);
  });

  it("keeps the stack bounded", () => {
    let h = start;
    for (let i = 0; i < 500; i++) h = commit(h, `v${i}`, false);
    expect(h.past.length).toBeLessThanOrEqual(60);
    expect(h.present).toBe("v499");
  });
});
