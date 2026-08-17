"use client";

import dynamic from "next/dynamic";
import React from "react";
import type { Design } from "../../lib/model";
import { useT } from "../../lib/i18n";
import { formatDate } from "./ui";

const ShelfViewer = dynamic(() => import("../ShelfViewer"), { ssr: false });

const WALL = "#ece7df"; // same warm niche tone as /library, for visual consistency

/** Mounts the 3D preview only once the card is near the viewport — same
 *  reasoning as /library's LazyStage: a page of saved designs shouldn't hold
 *  more WebGL contexts than are actually on screen. */
function LazyStage({ design }: { design: Design }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      {visible && <ShelfViewer design={design} background={WALL} height={220} interactive={false} autoRotate lite fit={1.1} />}
    </div>
  );
}

export interface SavedDesign {
  slug: string;
  name: string | null;
  design: Design;
  created_at: string;
}

export function SavedDesignCard({
  item,
  onRenamed,
  onDeleted,
}: {
  item: SavedDesign;
  onRenamed: (slug: string, name: string) => void;
  onDeleted: (slug: string) => void;
}) {
  const t = useT();
  const [editing, setEditing] = React.useState(false);
  const [draftName, setDraftName] = React.useState(item.name ?? "");
  const [busy, setBusy] = React.useState(false);
  const { w, h, d } = item.design.outerCm;

  async function saveName() {
    const name = draftName.trim();
    if (!name || name === item.name) {
      setEditing(false);
      setDraftName(item.name ?? "");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/account/designs/${item.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("rename_failed");
      onRenamed(item.slug, name);
      setEditing(false);
    } catch {
      setDraftName(item.name ?? "");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t("account.designs.deleteConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/account/designs/${item.slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      onDeleted(item.slug);
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#ece7df]">
        <LazyStage design={item.design} />
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/92 px-2 py-1 font-mono text-[11px] font-medium text-zinc-800 ring-1 ring-zinc-900/10 backdrop-blur">
          {Math.round(w)} × {Math.round(h)} × {Math.round(d)} cm
        </span>
      </div>
      <div className="p-4">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraftName(item.name ?? "");
                }
              }}
              className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={saveName}
              disabled={busy}
              className="shrink-0 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {t("account.designs.renameSave")}
            </button>
          </div>
        ) : (
          <h3 className="truncate text-sm font-semibold text-zinc-900">{item.name || t("account.designs.untitled")}</h3>
        )}
        <p className="mt-1 text-xs text-zinc-500">{t("account.designs.savedOn", { date: formatDate(item.created_at) })}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <a href={`/design?d=${item.slug}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
            {t("account.designs.open")} →
          </a>
          {!editing && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-zinc-600 hover:text-zinc-900">
                {t("account.designs.rename")}
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
              >
                {t("account.designs.delete")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
