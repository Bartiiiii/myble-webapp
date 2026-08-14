import Link from "next/link";
import { fetchOrders, ORDER_STATUSES } from "@/lib/backstageData";
import { EmptyState, ExportButton, formatCzk, formatDate, StatusBadge } from "@/components/admin/ui";

export default async function BackstageOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const orders = await fetchOrders(status);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-zinc-500">{orders.length} order{orders.length === 1 ? "" : "s"}{status ? ` · ${status.replaceAll("_", " ")}` : ""}</p>
        </div>
        <ExportButton what="orders" />
      </header>

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
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-zinc-50 transition last:border-0 hover:bg-zinc-50/60">
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
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
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
