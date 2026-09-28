"use client";

import Link from "next/link";
import React from "react";
import { Avatar, type AvatarSize } from "../Avatar";
import type { Author } from "../../lib/designers";

/**
 * Who made this — avatar plus name, linking to their profile.
 *
 * Cards in the library are covered by a full-bleed click target that opens the
 * detail dialog, so this sits at a higher z-index and stops propagation:
 * tapping the designer must go to their profile, not open the piece.
 *
 * An author with no handle (a design whose owner never got a profile row) is
 * drawn as plain text, not a dead link.
 */
export function AuthorChip({
  author,
  size = "sm",
  strong = false,
  className = "",
  onNavigate,
}: {
  author: Author;
  size?: AvatarSize;
  /** Dialog/profile typography rather than the small type used on cards. */
  strong?: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  const inner = (
    <>
      <Avatar person={author} size={size} />
      <span className="truncate">{author.name}</span>
    </>
  );

  const typography = strong
    ? "text-sm font-semibold text-zinc-900"
    : "text-[11px] font-medium text-zinc-600 sm:text-xs";
  const base = `inline-flex min-w-0 items-center gap-1.5 ${typography} ${className}`;

  if (!author.handle) {
    return <span className={base}>{inner}</span>;
  }

  return (
    <Link
      href={`/u/${author.handle}`}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate?.();
      }}
      className={`press relative z-20 rounded-full transition hover:text-zinc-900 ${base}`}
    >
      {inner}
    </Link>
  );
}
