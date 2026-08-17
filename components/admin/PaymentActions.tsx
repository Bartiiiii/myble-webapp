"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Payment actions for the backstage. Client component because it needs handlers;
// all authority stays server-side in /api/admin/payments/[id].
// ─────────────────────────────────────────────────────────────────────────────

type Action = "sync" | "refund" | "capture" | "release";

export function PaymentActions({
  paymentId,
  status,
  amountCzk,
  refundedCzk,
}: {
  paymentId: string;
  status: string;
  amountCzk: number;
  refundedCzk: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState("");

  const outstanding = Math.max(0, amountCzk - refundedCzk);
  const canRefund = (status === "paid" || status === "refunded") && outstanding > 0;
  const canCapture = status === "authorized";
  const canRelease = status === "authorized" || status === "pending";

  async function run(action: Action, body: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "action failed");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} disabled={!!busy || pending} onClick={() => run("sync")}>
          {busy === "sync" ? "Syncing…" : "Re-sync from Comgate"}
        </button>

        {canCapture ? (
          <button className={btn} disabled={!!busy || pending} onClick={() => run("capture")}>
            {busy === "capture" ? "Capturing…" : "Capture"}
          </button>
        ) : null}

        {canRelease ? (
          <button className={btn} disabled={!!busy || pending} onClick={() => run("release")}>
            {busy === "release" ? "Releasing…" : "Release / cancel"}
          </button>
        ) : null}
      </div>

      {canRefund ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 p-3">
          <label className="text-xs font-medium text-zinc-600" htmlFor={`refund-${paymentId}`}>
            Refund (CZK)
          </label>
          <input
            id={`refund-${paymentId}`}
            type="number"
            min={1}
            max={outstanding}
            placeholder={String(outstanding)}
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            className="w-28 rounded-lg border border-zinc-300 px-2 py-1 text-sm tabular-nums"
          />
          <button
            className={btn}
            disabled={!!busy || pending}
            onClick={() => {
              const amt = refundAmount ? Number(refundAmount) : undefined;
              if (amt !== undefined && (!Number.isFinite(amt) || amt <= 0 || amt > outstanding)) {
                setError(`Refund must be between 1 and ${outstanding} CZK`);
                return;
              }
              if (
                !confirm(
                  `Refund ${amt ?? outstanding} CZK? This cannot be undone and costs 5 Kč.`,
                )
              )
                return;
              void run("refund", { amountCzk: amt });
            }}
          >
            {busy === "refund" ? "Refunding…" : refundAmount ? "Refund amount" : "Refund in full"}
          </button>
          <span className="text-xs text-zinc-500">
            {refundedCzk > 0 ? `${refundedCzk} Kč already refunded · ` : ""}
            {outstanding} Kč outstanding
          </span>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-600/20">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Approve / reject the design review on an order detail page. */
export function ReviewActions({
  orderId,
  reviewState,
  paymentStatus,
}: {
  orderId: string;
  reviewState: string;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (reviewState !== "pending") {
    return (
      <p className="text-sm text-zinc-600">
        Design review: <span className="font-medium">{reviewState}</span>
      </p>
    );
  }

  async function decide(decision: "approved" | "rejected") {
    if (
      decision === "rejected" &&
      paymentStatus === "paid" &&
      !confirm("Rejecting will REFUND the customer in full. Continue?")
    )
      return;
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "review failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Review note (optional) — why approved or rejected"
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          disabled={!!busy}
          onClick={() => decide("approved")}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-40"
        >
          {busy === "approved" ? "Approving…" : "Approve → release to production"}
        </button>
        <button
          disabled={!!busy}
          onClick={() => decide("rejected")}
          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-40"
        >
          {busy === "rejected"
            ? "Rejecting…"
            : paymentStatus === "paid"
              ? "Reject → refund customer"
              : "Reject"}
        </button>
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-600/20">
          {error}
        </p>
      ) : null}
    </div>
  );
}
