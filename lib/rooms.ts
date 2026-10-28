// Which room each library design is shown in (see components/rooms/Room.tsx).
//
// The house pieces each get a room chosen for what they are — the nightstand
// in a bedroom, the TV bench under a TV, the shoe bench by the front door.
// Community designs get a room that suits their category, picked by a stable
// hash of their id so neighbouring cards don't all share one room and a design
// keeps its room between visits.

import type { Design } from "./model";

export type RoomId =
  | "living"
  | "reading"
  | "music"
  | "study"
  | "lounge"
  | "loft"
  | "bedroom"
  | "tvwall"
  | "hallway"
  | "entry"
  | "office"
  | "terrace";

const CURATED: Record<string, RoomId> = {
  staggered: "living",
  catbench: "reading",
  record: "music",
  police: "study",
  coffee: "lounge",
  grid: "loft",
  nightstand: "bedroom",
  tvbench: "tvwall",
  skrinka: "hallway",
  shoebench: "entry",
  worknook: "office",
  stolek: "terrace",
};

const BY_CATEGORY: Record<string, RoomId[]> = {
  shelves: ["living", "study", "loft", "hallway"],
  tables: ["terrace", "reading", "loft", "music"],
  storage: ["hallway", "entry", "living", "loft"],
  media: ["music", "tvwall"],
  office: ["office", "study"],
  pets: ["reading", "living"],
  other: ["living", "loft", "terrace", "reading"],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function roomFor(item: { id: string; category: string; design: Design }): RoomId {
  const fixed = CURATED[item.id];
  if (fixed) return fixed;
  let options = BY_CATEGORY[item.category] ?? BY_CATEGORY.other;
  // A TV only goes over something low enough to sit under one.
  if (item.design.outerCm.h > 90) options = options.filter((r) => r !== "tvwall");
  if (options.length === 0) options = BY_CATEGORY.other;
  return options[hash(item.id) % options.length];
}
