// The house designers the curated Design Library is credited to.
//
// These people are made up — they are the seed community that makes the
// library read like a library of designs BY someone rather than a catalogue.
// They exist in two places on purpose:
//
//   • here, as the source of truth for names, avatars and credits, so cards
//     and profile pages render identically without a database round trip;
//   • in `public.profiles` (migration 0007), with the SAME fixed UUIDs, so
//     they can be followed and show up in backstage → Users next to real
//     sign-ins.
//
// Real (signed-in) people live only in `profiles`; this file never grows for
// them. Keep ids/handles in lockstep with 0007_community.sql.

/** What a card, dialog or profile header needs to draw a person. */
export interface Author {
  handle: string;
  name: string;
  /** Google profile photo, or null → initials avatar tinted by avatarColor. */
  avatarUrl: string | null;
  avatarColor: number;
  /** Seeded house designer rather than a real sign-in. */
  seed: boolean;
}

export interface SeedDesigner extends Author {
  id: string;
  bio: string;
}

export const SEED_DESIGNERS: SeedDesigner[] = [
  { id: "11111111-1111-4111-8111-000000000001", handle: "myble", name: "Myble Studio", avatarUrl: null, avatarColor: 0, seed: true, bio: "The house designs. Everything we build to show what the configurator can do." },
  { id: "11111111-1111-4111-8111-000000000002", handle: "tereza", name: "Tereza Malá", avatarUrl: null, avatarColor: 1, seed: true, bio: "Prague flat, too many books, one very specific alcove." },
  { id: "11111111-1111-4111-8111-000000000003", handle: "kuba", name: "Jakub Novák", avatarUrl: null, avatarColor: 2, seed: true, bio: "Records, a turntable, and furniture measured around both." },
  { id: "11111111-1111-4111-8111-000000000004", handle: "anna", name: "Anna Dvořáková", avatarUrl: null, avatarColor: 3, seed: true, bio: "Small rooms, low pieces, nothing that blocks a window." },
  { id: "11111111-1111-4111-8111-000000000005", handle: "martin", name: "Martin Kovář", avatarUrl: null, avatarColor: 4, seed: true, bio: "Working from a corner of the living room since 2020." },
  { id: "11111111-1111-4111-8111-000000000006", handle: "lucie", name: "Lucie Horáková", avatarUrl: null, avatarColor: 5, seed: true, bio: "Two cats. Their furniture comes first, apparently." },
  { id: "11111111-1111-4111-8111-000000000007", handle: "petr", name: "Petr Beneš", avatarUrl: null, avatarColor: 6, seed: true, bio: "Hallways, entryways, and the eternal shoe problem." },
];

const BY_HANDLE = new Map(SEED_DESIGNERS.map((d) => [d.handle, d]));

export function seedDesigner(handle: string): SeedDesigner | null {
  return BY_HANDLE.get(handle) ?? null;
}

/**
 * Who designed each curated piece. Every id in lib/library.ts must appear
 * here — `lib/library.test.ts` asserts it, so a new curated design cannot
 * ship without an author.
 */
export const CURATED_AUTHOR: Record<string, string> = {
  staggered: "tereza",
  grid: "tereza",
  record: "kuba",
  tvbench: "martin",
  worknook: "martin",
  coffee: "anna",
  nightstand: "anna",
  catbench: "lucie",
  shoebench: "petr",
  // The three configurator presets are ours.
  police: "myble",
  skrinka: "myble",
  stolek: "myble",
};

/** The author of a curated design, falling back to the studio. */
export function curatedAuthor(designId: string): Author {
  const d = seedDesigner(CURATED_AUTHOR[designId] ?? "myble") ?? SEED_DESIGNERS[0];
  return { handle: d.handle, name: d.name, avatarUrl: d.avatarUrl, avatarColor: d.avatarColor, seed: true };
}
