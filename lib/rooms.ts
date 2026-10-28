// Which room each library design is shown in (see components/rooms/Room.tsx).
//
// Every curated piece gets a room chosen for what it is — the nightstand in a
// bedroom, the TV bench under a TV, the shoe bench by the front door. With
// more pieces than rooms, several share one, so neighbours in the grid are
// spread over the rooms that suit their category. Community designs get a
// room that suits their category, picked by a stable hash of their id so a
// design keeps its room between visits.

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

export const CURATED_ROOMS: Record<string, RoomId> = {
  police: "study",
  grid: "loft",
  stolek: "bedroom",
  tvbench: "tvwall",
  record: "music",
  shoebench: "entry",
  catbench: "reading",
  offset: "living",
  slimtower: "hallway",
  library: "study",
  underwindow: "reading",
  divider: "loft",
  steps: "living",
  windowseat: "reading",
  toybox: "living",
  wardrobe: "bedroom",
  plantsteps: "loft",
  podtable: "lounge",
  traytable: "lounge",
  arch: "living",
  nest: "living",
  utable: "reading",
  lipstand: "bedroom",
  talltable: "bedroom",
  lowstand: "bedroom",
  catclimber: "reading",
};

const BY_CATEGORY: Record<string, RoomId[]> = {
  shelves: ["living", "study", "loft", "reading"],
  tables: ["lounge", "living", "reading", "terrace"],
  nightstands: ["bedroom"],
  media: ["tvwall", "music"],
  office: ["office", "study"],
  hallway: ["hallway", "entry"],
  storage: ["loft", "living", "study", "hallway"],
  pets: ["reading", "living"],
  other: ["living", "loft", "terrace", "reading"],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function roomFor(item: { id: string; category: string; design: Design }): RoomId {
  const fixed = CURATED_ROOMS[item.id];
  if (fixed) return fixed;
  let options = BY_CATEGORY[item.category] ?? BY_CATEGORY.other;
  // A TV only goes over something low enough to sit under one.
  if (item.design.outerCm.h > 90) options = options.filter((r) => r !== "tvwall");
  if (options.length === 0) options = BY_CATEGORY.other;
  return options[hash(item.id) % options.length];
}
