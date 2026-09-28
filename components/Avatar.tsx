import React from "react";
import type { Author } from "../lib/designers";

// One way to draw a person, everywhere: cards, dialogs, profile headers,
// backstage tables.
//
// Two states, no third: a photo when we have one (Google sign-in), otherwise
// initials on a fixed tint picked by `color`. The initials path needs no
// network request and no image host, which is why the seeded designers use it
// — nothing to break, nothing to load, identical every render.
//
// The tint classes are written out in full rather than composed at runtime:
// Tailwind only ships classes it can see as literals in the source.

const TINTS = [
  "bg-zinc-800 text-white",
  "bg-indigo-500 text-white",
  "bg-teal-600 text-white",
  "bg-amber-500 text-white",
  "bg-rose-500 text-white",
  "bg-violet-500 text-white",
  "bg-emerald-600 text-white",
  "bg-sky-600 text-white",
] as const;

export const AVATAR_COLORS = TINTS.length;

const SIZES = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;

export type AvatarSize = keyof typeof SIZES;

/** First letters of the first two words — "Tereza Malá" → "TM". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.slice(0, 2).map((p) => [...p][0] ?? "");
  return letters.join("").toUpperCase();
}

/** Stable tint for a person with no explicit colour (e.g. a legacy row). */
export function colorFromKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100_000;
  return h % AVATAR_COLORS;
}

export function Avatar({
  person,
  size = "md",
  className = "",
}: {
  person: Pick<Author, "name" | "avatarUrl" | "avatarColor" | "handle">;
  size?: AvatarSize;
  className?: string;
}) {
  // `inline-flex` belongs in the shared box, not just the initials branch: a
  // bare <span> is display:inline, where width/height and overflow clipping do
  // not apply — which rendered every photo avatar as an unclipped square.
  const box = `${SIZES[size]} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/5 ${className}`;

  if (person.avatarUrl) {
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      </span>
    );
  }

  const tint = TINTS[((person.avatarColor % AVATAR_COLORS) + AVATAR_COLORS) % AVATAR_COLORS];
  return (
    <span
      aria-hidden="true"
      className={`${box} font-semibold tracking-tight ${tint}`}
    >
      {initials(person.name || person.handle)}
    </span>
  );
}
