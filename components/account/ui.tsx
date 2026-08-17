import React from "react";

// Customer-facing account primitives — visually the same card chrome as
// components/admin/ui.tsx, but not imported from there: the admin module is a
// different trust boundary (raw status strings, internal formatting), and a
// public page depending on "admin" components is the wrong dependency
// direction even where the logic happens to be identical today.

export function formatCzk(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("cs-CZ").format(value)} Kč`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

const STATUS_STYLES: Record<string, string> = {
  received: "bg-sky-50 text-sky-700 ring-sky-600/20",
  confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  in_production: "bg-amber-50 text-amber-700 ring-amber-600/20",
  shipped: "bg-violet-50 text-violet-700 ring-violet-600/20",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-zinc-100 text-zinc-500 ring-zinc-500/20",
};

/** label is the already-translated, customer-friendly status text — never the raw DB string. */
export function StatusPill({ status, label }: { status: string; label: string }) {
  const style = STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-600 ring-zinc-500/20";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {label}
    </span>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white ring-1 ring-zinc-200">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ text, hint, cta }: { text: string; hint?: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center">
      <p className="text-sm font-medium text-zinc-700">{text}</p>
      {hint ? <p className="mt-1 text-sm text-zinc-500">{hint}</p> : null}
      {cta ? <div className="mt-4">{cta}</div> : null}
    </div>
  );
}
