"use client";

import React from "react";
import { useReactions } from "../lib/reactions";
import { useT } from "../lib/i18n";
import posthog from "posthog-js";

/**
 * 🔥 reaction control for a Design Library card.
 *
 * Lives inside a card that is itself a button/link, so it stops propagation —
 * tapping the flame must never also open the design in the configurator.
 */
export function FireButton({ id, size = "md" }: { id: string; size?: "sm" | "md" }) {
  const { counts, reacted, toggle } = useReactions();
  const t = useT();
  const isOn = reacted.has(id);
  const count = counts[id] ?? 0;

  const small = size === "sm";

  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label={t("library.fireLabel")}
      title={t("library.fireLabel")}
      onClick={(e) => {
        // The card behind this is clickable — don't open the configurator.
        e.preventDefault();
        e.stopPropagation();
        if (!isOn) posthog.capture("design_fired", { id });
        toggle(id);
      }}
      className={`press pointer-events-auto inline-flex items-center gap-1 rounded-full font-mono font-medium tabular-nums ring-1 backdrop-blur transition ${
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${
        isOn
          ? "bg-amber-500/95 text-white ring-amber-600/20"
          : "bg-white/92 text-zinc-700 ring-zinc-900/10 hover:bg-white"
      }`}
    >
      <span className={isOn ? "" : "grayscale"} aria-hidden="true">
        🔥
      </span>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
