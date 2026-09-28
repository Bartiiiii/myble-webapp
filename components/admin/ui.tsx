import type { DeliveryDeadline } from "@/lib/deliveryDeadline";
import React from "react";

// Server-safe backstage primitives: badges, KPI cards, tables, charts.

// Categorical chart palette, fixed assignment order, validated for CVD +
// contrast on a white surface. Lives here (no "use client") so BOTH server
// pages and client chart components get the real values — exporting it from a
// client module would hand server components an opaque client-reference proxy.
export const CHART_COLORS = ["#4f46e5", "#0d9488", "#d97706", "#db2777"] as const;

export function formatCzk(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("cs-CZ").format(value)} Kč`;
}

export function formatDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

const STATUS_STYLES: Record<string, string> = {
  received: "bg-sky-50 text-sky-700 ring-sky-600/20",
  confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  in_production: "bg-amber-50 text-amber-700 ring-amber-600/20",
  shipped: "bg-violet-50 text-violet-700 ring-violet-600/20",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-zinc-100 text-zinc-500 ring-zinc-500/20",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-600 ring-zinc-500/20";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

/**
 * Days left against the T&C §6.2a 28-day delivery deadline. Silent for orders
 * the clock does not apply to (unpaid, or already shipped/cancelled), so the
 * column only draws the eye when something actually needs doing.
 */
export function DeadlineBadge({ deadline }: { deadline: DeliveryDeadline }) {
  if (!deadline.tracked) return <span className="text-zinc-400">—</span>;

  if (deadline.level === "ok") {
    return <span className="tabular-nums text-zinc-500">{deadline.daysLeft} d left</span>;
  }

  const style =
    deadline.level === "overdue"
      ? "bg-rose-50 text-rose-700 ring-rose-600/20"
      : "bg-amber-50 text-amber-700 ring-amber-600/20";
  const label =
    deadline.level === "overdue"
      ? `${Math.abs(deadline.daysLeft)} d overdue`
      : `${deadline.daysLeft} d left`;

  return (
    <span
      title={`Paid ${deadline.daysElapsed} days ago · must be delivered by ${formatDate(deadline.dueAt, false)} (T&C §6.2a)`}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}

export function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function Section({
  title,
  action,
  fill = false,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  /** Stretch to the height of the grid row and let the body fill what's left —
   *  how two side-by-side sections end up the same height. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl bg-white ring-1 ring-zinc-200${fill ? " flex h-full flex-col" : ""}`}>
      <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {action}
      </header>
      <div className={fill ? "flex min-h-0 flex-1 flex-col p-5" : "p-5"}>{children}</div>
    </section>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
      {text}
    </p>
  );
}

export function ExportButton({ what }: { what: string }) {
  return (
    <a
      href={`/api/admin/export?what=${what}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M8 2v8m0 0 3-3M8 10 5 7M3 13h10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Export CSV
    </a>
  );
}
