"use client";

// The group operations, shared by the two places they are offered: the canvas
// menu button and the right-click menu on a selection.
//
// Each heading opens in place rather than flying out sideways. A flyout needs
// room beside the menu and a pointer that can hover, and this menu has to work
// the same in the corner of a phone screen — where the menu button is the only
// way in, because there is no right-click.
import React, { useState } from "react";
import type { TFn } from "../../lib/i18n";

/** Where a group lines up, named for the screen rather than for an axis. */
export type AlignDir = "left" | "centre" | "right" | "top" | "middle" | "bottom";

export interface ArrangeMenuProps {
  /** How many boards are in the selection — distributing needs three. */
  count: number;
  onAlign: (dir: AlignDir) => void;
  onDistribute: (horizontal: boolean) => void;
  translate: TFn;
  /** Called after any operation, so the menu that hosts this can close. */
  onDone?: () => void;
}

export function ArrangeMenu({ count, onAlign, onDistribute, translate: t, onDone }: ArrangeMenuProps) {
  const [open, setOpen] = useState<string | null>(null);
  const canDistribute = count >= 3;

  const run = (fn: () => void) => {
    fn();
    onDone?.();
  };

  return (
    <div className="py-1">
      <Group
        id="alignH"
        label={t("arrange.alignH")}
        icon={<AlignHIcon />}
        open={open === "alignH"}
        onToggle={() => setOpen(open === "alignH" ? null : "alignH")}
      >
        <Item text={t("arrange.left")} onClick={() => run(() => onAlign("left"))} />
        <Item text={t("arrange.centre")} onClick={() => run(() => onAlign("centre"))} />
        <Item text={t("arrange.right")} onClick={() => run(() => onAlign("right"))} />
      </Group>

      <Group
        id="alignV"
        label={t("arrange.alignV")}
        icon={<AlignVIcon />}
        open={open === "alignV"}
        onToggle={() => setOpen(open === "alignV" ? null : "alignV")}
      >
        <Item text={t("arrange.top")} onClick={() => run(() => onAlign("top"))} />
        <Item text={t("arrange.middle")} onClick={() => run(() => onAlign("middle"))} />
        <Item text={t("arrange.bottom")} onClick={() => run(() => onAlign("bottom"))} />
      </Group>

      <Group
        id="dist"
        label={t("arrange.distribute")}
        icon={<DistributeIcon />}
        open={open === "dist"}
        onToggle={() => setOpen(open === "dist" ? null : "dist")}
        // Two boards have nothing between them to even out.
        disabled={!canDistribute}
        hint={canDistribute ? undefined : t("arrange.needsThree")}
      >
        <Item text={t("arrange.horizontally")} onClick={() => run(() => onDistribute(true))} />
        <Item text={t("arrange.vertically")} onClick={() => run(() => onDistribute(false))} />
      </Group>
    </div>
  );
}

function Group({
  label,
  icon,
  open,
  onToggle,
  disabled = false,
  hint,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        title={hint}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
      >
        <span className="shrink-0 text-zinc-400">{icon}</span>
        <span className="flex-1">{label}</span>
        <span className={`text-[10px] text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && !disabled && <div className="pb-1 pl-10 pr-2">{children}</div>}
    </div>
  );
}

function Item({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-zinc-600 transition hover:bg-indigo-50 hover:text-indigo-700"
    >
      {text}
    </button>
  );
}

// Small glyphs echoing the operation: a stack of bars against a rule.
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
};

function AlignHIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" {...stroke}>
      <path d="M2.5 2v12" />
      <path d="M4.5 5.5h8" />
      <path d="M4.5 10.5h5" />
    </svg>
  );
}

function AlignVIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" {...stroke}>
      <path d="M2 2.5h12" />
      <path d="M5.5 4.5v8" />
      <path d="M10.5 4.5v5" />
    </svg>
  );
}

function DistributeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" {...stroke}>
      <path d="M2.5 3.5v9" />
      <path d="M8 2v12" />
      <path d="M13.5 3.5v9" />
    </svg>
  );
}
