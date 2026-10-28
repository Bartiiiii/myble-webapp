import { describe, expect, it } from "vitest";
import { LIBRARY } from "./library";
import { roomFor } from "./rooms";

describe("roomFor", () => {
  it("gives every curated piece its own room", () => {
    const rooms = LIBRARY.map((item) => roomFor(item));
    expect(new Set(rooms).size).toBe(LIBRARY.length);
  });

  it("keeps a community design in the same room every time", () => {
    const base = LIBRARY[0];
    const item = { ...base, id: "someones-shelf", category: "shelves" as const };
    expect(roomFor(item)).toBe(roomFor({ ...item }));
  });

  it("never puts a TV over a tall media piece", () => {
    const base = LIBRARY.find((i) => i.category === "media")!;
    const tall = { ...base.design, outerCm: { ...base.design.outerCm, h: 180 } };
    for (let i = 0; i < 40; i++) {
      expect(roomFor({ id: `tall-${i}`, category: "media", design: tall })).not.toBe("tvwall");
    }
  });
});
