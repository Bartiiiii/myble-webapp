import Link from "next/link";
import {
  PAYMENT_STATUSES,
  fetchPaymentStats,
  fetchPayments,
  fetchSettlements,
} from "@/lib/backstagePayments";
import { EmptyState, Kpi, Section, formatCzk, formatDate } from "@/components/admin/ui";
import { PaymentActions } from "@/components/admin/PaymentActions";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/payments — the payments dashboard.
//
// Add to the backstage nav in app/admin/(backstage)/layout.tsx:
//   { href: "/admin/payments", label: "Payments" }
// ─────────────────────────────────────────────────────────────────────────────

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  created: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  authorized: "bg-sky-50 text-sky-700 ring-sky-600/20",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-zinc-100 text-zinc-500 ring-zinc-500/20",
  refunded: "bg-violet-50 text-violet-700 ring-violet-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
};

function PaymentBadge({ status }: { status: string }) {
  const style = PAYMENT_STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-600 ring-zinc-500/20";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {status}
    </span>
  );
}

/** Comgate method ids are machine-shaped; make them readable. */
function methodLabel(method: string | null): string {
  if (!method) return "—";
  if (method.startsWith("BANK_")) return `Bank button · ${method.split("_").slice(1, 3).join(" ")}`;
  if (method.startsWith("CARD_")) return "Card";
  if (method.startsWith("APPLEPAY")) return "Apple Pay";
  if (method.startsWith("GOOGLEPAY")) return "Google Pay";
  if (method.startsWith("LATER_")) return "Deferred payment";
  if (method.startsWith("PART_") || method.startsWith("LOAN_")) return "Instalments";
  if (method === "BLIK") return "BLIK";
  return method;
}

export default async function BackstagePayments({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const [payments, stats, settlements] = await Promise.all([
    fetchPayments(status),
    fetchPaymentStats(),
    fetchSettlements(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {payments.length} payment{payments.length === 1 ? "" : "s"}
          {status ? ` · ${status}` : ""} · Comgate
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Captured (net)" value={formatCzk(stats.capturedCzk)} hint="after refunds" />
        <Kpi label="Last 30 days" value={formatCzk(stats.captured30dCzk)} />
        <Kpi
          label="Checkout conversion"
          value={stats.conversionPct != null ? `${(stats.conversionPct * 100).toFixed(0)}%` : "—"}
          hint="payment attempts that completed"
        />
        <Kpi
          label="Effective fee rate"
          value={stats.effectiveFeePct != null ? `${(stats.effectiveFeePct * 100).toFixed(2)}%` : "—"}
          hint="vs 1.80% assumed in pricingConfig"
        />
      </div>

      {/* The method mix is the single most valuable number on this page. The
          whole provider decision rested on Czech bank buttons being ~28% of
          demand — this is where that assumption meets reality. */}
      <Section title="Payment method mix (actual)">
        {stats.methodMix.length === 0 ? (
          <EmptyState text="No completed payments yet." />
        ) : (
          <div className="space-y-2">
            {stats.methodMix.map((m) => (
              <div key={m.method} className="flex items-center gap-3 text-sm">
                <span className="w-56 shrink-0 truncate text-zinc-700">{methodLabel(m.method)}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-zinc-100">
                  <div
                    className="h-full rounded-md bg-indigo-600"
                    style={{ width: `${Math.max(2, m.share * 100)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right tabular-nums text-zinc-600">
                  {(m.share * 100).toFixed(0)}%
                </span>
                <span className="w-28 shrink-0 text-right tabular-nums text-zinc-500">
                  {formatCzk(m.czk)}
                </span>
              </div>
            ))}
            <p className="pt-2 text-xs text-zinc-500">
              If bank buttons land far below ~28% of orders, re-run the provider cost model — the
              card-only platforms become competitive again.
            </p>
          </div>
        )}
      </Section>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/payments"
          className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${!status ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50"}`}
        >
          All
        </Link>
        {PAYMENT_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/payments?status=${s}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${status === s ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-zinc-200">
        {payments.length === 0 ? (
          <div className="p-5">
            <EmptyState text="No payments match this filter." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 font-medium">Method</th>
                  <th className="px-3 py-3 text-right font-medium">Amount</th>
                  <th className="px-3 py-3 text-right font-medium">Refunded</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Settled</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-50 align-top last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/orders/${p.order_id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        {p.order_no}
                      </Link>
                      {p.is_test ? (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                          test
                        </span>
                      ) : null}
                      {p.trans_id ? (
                        <span className="block font-mono text-[11px] text-zinc-400">{p.trans_id}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{formatDate(p.created_at)}</td>
                    <td className="px-3 py-3 text-zinc-700">
                      {methodLabel(p.method)}
                      {p.card_number_masked ? (
                        <span className="block text-xs text-zinc-500">{p.card_number_masked}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatCzk(p.amount_minor / 100)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-zinc-500">
                      {p.refunded_minor ? formatCzk(p.refunded_minor / 100) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <PaymentBadge status={p.status} />
                      {p.error_reason ? (
                        <span className="mt-1 block max-w-48 text-xs text-red-600">
                          {p.error_reason}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-500">
                      {p.settled_transfer_id ? formatDate(p.settled_at, false) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <PaymentActions
                        paymentId={p.id}
                        status={p.status}
                        amountCzk={p.amount_minor / 100}
                        refundedCzk={p.refunded_minor / 100}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Section title="Settlements (Comgate payouts)">
        {settlements.length === 0 ? (
          <EmptyState text="No settlements pulled yet. The daily cron populates this." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Transfer</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Account</th>
                  <th className="py-2 pr-3 text-right font-medium">Matched</th>
                  <th className="py-2 text-right font-medium">Payments</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-50 last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{s.transfer_id}</td>
                    <td className="py-2 pr-3 text-zinc-600">{formatDate(s.transfer_date, false)}</td>
                    <td className="py-2 pr-3 text-zinc-600">{s.account ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatCzk(s.matched_minor / 100)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-zinc-500">{s.matched_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pt-3 text-xs text-zinc-500">
              {formatCzk(stats.unsettledCzk)} captured but not yet matched to a payout.
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}
