import Link from "next/link";
import { fetchDashboardStats } from "@/lib/backstageData";
import {
  CHART_COLORS,
  EmptyState,
  formatCzk,
  formatDate,
  Kpi,
  Section,
  StatusBadge,
} from "@/components/admin/ui";
import { InteractiveBars } from "@/components/admin/charts";

export default async function BackstageDashboard() {
  const stats = await fetchDashboardStats();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Everything happening on my-ble.eu, at a glance.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Revenue (all time)" value={formatCzk(stats.revenueTotalCzk)} hint={`${formatCzk(stats.revenue30dCzk)} last 30 days`} />
        <Kpi label="Orders" value={stats.ordersTotal} hint={`${stats.orders30d} last 30 days`} />
        <Kpi label="Subscribers" value={stats.subscribersActive} hint={`+${stats.subscribers30d} last 30 days`} />
        <Kpi label="Open messages" value={stats.messagesUnhandled} hint="awaiting a reply" />
        <Kpi label="Saved designs" value={stats.designsTotal} hint="shared configurations" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Section title="Last 14 days">
            <InteractiveBars
              data={stats.dailyOrders.map((d) => ({ label: d.day, values: [d.orders, d.signups] }))}
              series={[
                { name: "Orders", color: CHART_COLORS[0] },
                { name: "Newsletter signups", color: CHART_COLORS[1] },
              ]}
              labelKind="date"
            />
          </Section>
        </div>
        <div className="lg:col-span-2">
          <Section title="Order pipeline">
            <ul className="space-y-2.5">
              {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                <li key={status} className="flex items-center justify-between">
                  <StatusBadge status={status} />
                  <span className="text-sm font-medium tabular-nums text-zinc-700">{count}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      <Section
        title="Recent orders"
        action={<Link href="/admin/orders" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">View all →</Link>}
      >
        {stats.recentOrders.length === 0 ? (
          <EmptyState text="No orders yet — they will appear here the moment one lands." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">Order</th>
                  <th className="pb-2 pr-4 font-medium">Placed</th>
                  <th className="pb-2 pr-4 font-medium">Customer</th>
                  <th className="pb-2 pr-4 font-medium">Total</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-zinc-50 last:border-0">
                    <td className="py-2.5 pr-4">
                      <Link href={`/admin/orders/${o.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                        {o.order_no}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600">{formatDate(o.created_at)}</td>
                    <td className="py-2.5 pr-4 text-zinc-600">
                      {[o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || "—"}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{formatCzk(o.total_price_czk)}</td>
                    <td className="py-2.5"><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Unanswered messages"
        action={<Link href="/admin/messages" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">Inbox →</Link>}
      >
        {stats.recentMessages.length === 0 ? (
          <EmptyState text="Inbox zero — no contact messages waiting." />
        ) : (
          <ul className="divide-y divide-zinc-50">
            {stats.recentMessages.map((m) => (
              <li key={m.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-zinc-900">{m.name} <span className="font-normal text-zinc-500">· {m.email}</span></p>
                  <p className="shrink-0 text-xs text-zinc-500">{formatDate(m.created_at)}</p>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{m.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
