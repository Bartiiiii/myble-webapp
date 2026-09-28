import Link from "next/link";
import { fetchOrdersWithDeadlines, ORDER_STATUSES } from "@/lib/backstageData";
import { coerceDesign } from "@/lib/build";
import { type MebleItem } from "@/lib/mebleExport";
import { DeadlineBadge, EmptyState, ExportButton, formatCzk, formatDate, StatusBadge } from "@/components/admin/ui";
import { MebleProduction } from "@/components/admin/MebleProduction";

export default async function BackstageOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  // Orders arrive already classified against the T&C §6.2a 28-day delivery
  // deadline and sorted most-urgent-first — this list is the only place that
  // deadline is visible before it is breached.
  const { orders, atRisk, overdue } = await fetchOrdersWithDeadlines(status);

  // One meble upload per material covers every order in the filter, so the
  // batch panel only makes sense once you've narrowed to a production run
  // (typically "confirmed") — not on the unfiltered list.
  const batchItems: MebleItem[] = status
    ? orders.flatMap(({ order: o }) => {
        const design = coerceDesign(o.design ?? o.design_spec);
        return design ? [{ ref: o.order_no, design }] : [];
      })
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-zinc-500">{orders.length} order{orders.length === 1 ? "" : "s"}{status ? ` · ${status.replaceAll("_", " ")}` : ""}</p>
        </div>
        <ExportButton what="orders" />
      </header>

      {atRisk.length > 0 ? (
        <div
          className={`rounded-2xl px-5 py-4 text-sm ring-1 ${
            overdue.length > 0 ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-amber-50 text-amber-900 ring-amber-200"
          }`}
        >
          <p className="font-semibold">
            {overdue.length > 0
              ? `${overdue.length} order${overdue.length === 1 ? " is" : "s are"} past the 28-day delivery deadline`
              : `${atRisk.length} order${atRisk.length === 1 ? "" : "s"} approaching the 28-day delivery deadline`}
          </p>
          <p className="mt-1">
            Paid and not yet shipped. T&amp;C §6.2a commits us to delivery within 28 days of payment, so these are
            listed first{overdue.length > 0 && atRisk.length > overdue.length ? `, followed by ${atRisk.length - overdue.length} due soon` : ""}.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${!status ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50"}`}
        >
          All
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${status === s ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50"}`}
          >
            {s.replaceAll("_", " ")}
          </Link>
        ))}
      </div>

      {batchItems.length > 0 ? (
        <MebleProduction items={batchItems} query={`status=${status}`} />
      ) : null}

      <div className="rounded-2xl bg-white ring-1 ring-zinc-200">
        {orders.length === 0 ? (
          <div className="p-5"><EmptyState text="No orders match this filter." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">Placed</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">City</th>
                  <th className="px-3 py-3 font-medium">Delivery</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium" title="T&amp;C §6.2a: delivery due 28 days after payment">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(({ order: o, deadline }) => (
                  <tr
                    key={o.id}
                    className={`border-b border-zinc-50 transition last:border-0 hover:bg-zinc-50/60 ${
                      deadline.level === "overdue" ? "bg-rose-50/40" : deadline.level === "due" ? "bg-amber-50/40" : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                        {o.order_no}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{formatDate(o.created_at)}</td>
                    <td className="px-3 py-3 text-zinc-800">
                      {[o.first_name, o.last_name].filter(Boolean).join(" ") || "—"}
                      {o.email ? <span className="block text-xs text-zinc-500">{o.email}</span> : null}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{o.city ?? "—"}</td>
                    <td className="px-3 py-3 text-zinc-600">{o.delivery_method ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCzk(o.total_price_czk)}</td>
                    <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3"><DeadlineBadge deadline={deadline} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
