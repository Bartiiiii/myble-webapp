"use client";

import { useRouter } from "next/navigation";
import React from "react";

// Client-side backstage controls: login form, logout, order status editor,
// message handled toggle. All mutations go through /api/admin/*.

export function BackstageLoginForm() {
  const router = useRouter();
  const [login, setLogin] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      if (res.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      setError(
        res.status === 429
          ? "Too many attempts — wait 15 minutes and try again."
          : "Wrong login or password.",
      );
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Login</span>
        <input
          type="text"
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
          className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </label>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
      >
        {busy ? "Checking…" : "Enter backstage"}
      </button>
    </form>
  );
}

export function BackstageLogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v7A1.5 1.5 0 0 0 3.5 13H6m4-2.5L12.5 8 10 5.5M12.5 8H6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Lock backstage
    </button>
  );
}

const STATUSES = ["received", "confirmed", "in_production", "shipped", "delivered", "cancelled"];

export function OrderStatusControl({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(status);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-800 outline-none focus:border-indigo-500"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={busy || value === status}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40"
      >
        {busy ? "Saving…" : saved ? "Saved ✓" : "Update"}
      </button>
    </div>
  );
}

export function MessageHandledToggle({ messageId, handled }: { messageId: string; handled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch(`/api/admin/messages/${messageId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ handled: !handled }),
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition disabled:opacity-50 ${
        handled
          ? "bg-zinc-50 text-zinc-500 ring-zinc-300 hover:bg-zinc-100"
          : "bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-500"
      }`}
    >
      {handled ? "Reopen" : "Mark handled"}
    </button>
  );
}
