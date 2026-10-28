"use client";

// One house (curated) design in backstage → Designs → Live in library.
//
// These pieces are authored by us and credited to the seeded house designers,
// so unlike community submissions there is nothing to approve: backstage edits
// them instead. "Edit in configurator" opens the piece in the real editor with
// a Publish update bar (app/[locale]/design/page.tsx, ?curated=<id>); "Revert"
// drops the published edit so the version in lib/library.ts shows again.
//
// Wraps its own LocaleProvider for the same reason as SubmissionCard:
// ShelfViewer calls useT(), and backstage has no i18n provider.

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import React from "react";
import type { Design } from "@/lib/model";
import { LocaleProvider, useT } from "@/lib/i18n";
import { formatDate } from "./ui";

const ShelfViewer = dynamic(() => import("@/components/ShelfViewer"), { ssr: false });

const WALL = "#ece7df";

export interface CuratedEntry {
  id: string;
  category: string;
  design: Design;
  author: { handle: string; name: string };
  /** Set when backstage has published an edit over the version in code. */
  edited: { version: number; updatedAt: string } | null;
}

export function CuratedCard({ item }: { item: CuratedEntry }) {
  return (
    <LocaleProvider locale="en">
      <CuratedCardBody item={item} />
    </LocaleProvider>
  );
}

function CuratedCardBody({ item }: { item: CuratedEntry }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { w, h, d } = item.design.outerCm;

  async function revert() {
    if (!window.confirm("Revert this design to its original version? The published edit is removed.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/library/${item.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok || !body?.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setError("Could not revert. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
      <div className="relative aspect-[4/3] bg-[#ece7df]">
        <ShelfViewer design={item.design} background={WALL} height={260} interactive autoRotate fit={1.05} />
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/92 px-2 py-1 font-mono text-[11px] font-medium text-zinc-800 ring-1 ring-zinc-900/10 backdrop-blur">
          {Math.round(w)} × {Math.round(h)} × {Math.round(d)} cm
        </span>
        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
          house design
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="truncate text-sm font-semibold text-zinc-900">{t(`library.items.${item.id}.n`)}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {item.category} ·{" "}
            {item.edited
              ? `edited, version ${item.edited.version} · ${formatDate(item.edited.updatedAt)}`
              : "original version"}
          </p>
        </div>

        <div className="text-xs text-zinc-600">
          Shown as <span className="font-medium text-zinc-900">{item.author.name}</span>
          <a href={`/u/${item.author.handle}`} target="_blank" className="ml-1.5 text-indigo-600 hover:text-indigo-500">
            @{item.author.handle} ↗
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <a
            href={`/en/design?curated=${item.id}`}
            target="_blank"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            Edit in configurator ↗
          </a>
          {item.edited && (
            <button
              type="button"
              onClick={revert}
              disabled={busy}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-60"
            >
              {busy ? "Reverting…" : "Revert to original"}
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
