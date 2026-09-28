"use client";

// One community submission, as backstage sees it: the actual piece, who sent
// it, and the two decisions that matter.
//
// Nothing a customer shares reaches the public library on its own — approving
// here is what publishes it. So the card leads with the 3D preview: the point
// of the queue is looking at the design, not reading a row of metadata.
//
// Backstage has no i18n provider (it is English-only), but ShelfViewer calls
// useT() unconditionally, so this wraps its own LocaleProvider — same reason
// as components/admin/OrderDesignViewer.tsx.

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import React from "react";
import type { Design } from "@/lib/model";
import { LocaleProvider } from "@/lib/i18n";
import { formatDate } from "./ui";

const ShelfViewer = dynamic(() => import("@/components/ShelfViewer"), { ssr: false });

const WALL = "#ece7df";

export interface Submission {
  id: string;
  slug: string;
  title: string | null;
  note: string | null;
  category: string | null;
  categoryCustom: string | null;
  design: Design;
  share_status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  user_email: string | null;
  author: { handle: string; name: string; avatarUrl: string | null; avatarColor: number } | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-zinc-100 text-zinc-500 ring-zinc-500/20",
};

export function SubmissionCard({ item }: { item: Submission }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState(item.share_status);
  const [error, setError] = React.useState<string | null>(null);
  const { w, h, d } = item.design.outerCm;

  async function review(action: "approve" | "reject" | "unpublish") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/designs/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) throw new Error("failed");
      setStatus(body.status);
      // Re-run the server component so the KPI counts and any active filter
      // agree with what just happened.
      router.refresh();
    } catch {
      setError("Could not save that. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
      <div className="relative aspect-[4/3] bg-[#ece7df]">
        <LocaleProvider>
          <ShelfViewer design={item.design} background={WALL} height={260} interactive autoRotate fit={1.05} />
        </LocaleProvider>
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/92 px-2 py-1 font-mono text-[11px] font-medium text-zinc-800 ring-1 ring-zinc-900/10 backdrop-blur">
          {Math.round(w)} × {Math.round(h)} × {Math.round(d)} cm
        </span>
        <span
          className={`pointer-events-none absolute right-3 top-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
            STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-600 ring-zinc-500/20"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="truncate text-sm font-semibold text-zinc-900">{item.title || "Untitled"}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {item.category ?? "—"}
            {item.categoryCustom ? ` (“${item.categoryCustom}”)` : ""} · {formatDate(item.submitted_at)}
          </p>
        </div>

        <div className="text-xs text-zinc-600">
          <span className="font-medium text-zinc-900">{item.author?.name ?? "No profile"}</span>
          {item.author?.handle && (
            <a href={`/u/${item.author.handle}`} target="_blank" className="ml-1.5 text-indigo-600 hover:text-indigo-500">
              @{item.author.handle} ↗
            </a>
          )}
          <p className="mt-0.5 truncate text-zinc-400">{item.user_email ?? "—"}</p>
        </div>

        {item.note && <p className="rounded-lg bg-zinc-50 p-2.5 text-xs leading-5 text-zinc-600">{item.note}</p>}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {status !== "published" && (
            <button
              type="button"
              onClick={() => review("approve")}
              disabled={busy !== null}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy === "approve" ? "Publishing…" : "Approve & publish"}
            </button>
          )}
          {status === "published" && (
            <button
              type="button"
              onClick={() => review("unpublish")}
              disabled={busy !== null}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-60"
            >
              {busy === "unpublish" ? "Pulling…" : "Unpublish"}
            </button>
          )}
          {status !== "rejected" && (
            <button
              type="button"
              onClick={() => review("reject")}
              disabled={busy !== null}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 disabled:opacity-60"
            >
              {busy === "reject" ? "Rejecting…" : "Reject"}
            </button>
          )}
          <a
            href={`/design?d=${item.slug}`}
            target="_blank"
            className="ml-auto text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            Open in configurator ↗
          </a>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
