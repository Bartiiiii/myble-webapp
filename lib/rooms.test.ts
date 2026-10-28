import { describe, expect, it } from "vitest";
import { LIBRARY } from "./library";
import { CURATED_ROOMS, roomFor } from "./rooms";

describe("roomFor", () => {
  it("gives every curated piece a room chosen for it", () => {
    for (const item of LIBRARY) expect(CURATED_ROOMS[item.id], item.id).toBeTruthy();
  });

  it("never stands a tall curated piece under the TV", () => {
    for (const item of LIBRARY) {
      if (item.design.outerCm.h > 90) expect(roomFor(item), item.id).not.toBe("tvwall");
    }
  });

  it("spreads the curated pieces over the rooms rather than piling them in one", () => {
    const counts = new Map<string, number>();
    for (const item of LIBRARY) counts.set(roomFor(item), (counts.get(roomFor(item)) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(Math.max(2, Math.ceil(LIBRARY.length / 4)));
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
