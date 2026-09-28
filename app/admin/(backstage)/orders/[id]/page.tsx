import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchOrder, fetchOrderDeadline } from "@/lib/backstageData";
import { coerceDesign } from "@/lib/build";
import { DeadlineBadge, formatCzk, formatDate, Section, StatusBadge } from "@/components/admin/ui";
import { OrderStatusControl } from "@/components/admin/BackstageControls";
import { MebleProduction } from "@/components/admin/MebleProduction";
import { OrderDesignViewer } from "@/components/admin/OrderDesignViewer";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900">{value ?? "—"}</dd>
    </div>
  );
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  return (
    <details className="group rounded-xl border border-zinc-200">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
        {title}
      </summary>
      <pre className="max-h-96 overflow-auto border-t border-zinc-100 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export default async function BackstageOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await fetchOrder(id);
  if (!order) notFound();

  // Same §6.2a clock the orders list shows, so acting on one order does not
  // require going back to the list to see how much time is left.
  const deadline = fetchOrderDeadline(order);
  const customerName = [order.first_name, order.last_name].filter(Boolean).join(" ");
  const design = coerceDesign(order.design ?? order.design_spec);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-xs font-medium text-zinc-500 hover:text-zinc-700">← Orders</Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {order.order_no} <StatusBadge status={order.status} /> <DeadlineBadge deadline={deadline} />
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Placed {formatDate(order.created_at)} · locale {order.locale}
            {order.updated_at ? ` · updated ${formatDate(order.updated_at)}` : ""}
            {deadline.tracked ? ` · paid ${formatDate(order.paid_at, false)}, delivery due ${formatDate(deadline.dueAt, false)} (T&C §6.2a)` : ""}
          </p>
        </div>
        <OrderStatusControl orderId={order.id} status={order.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Customer">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Name" value={customerName || "—"} />
            <Field
              label="E-mail"
              value={order.email ? <a className="text-indigo-600 hover:text-indigo-500" href={`mailto:${order.email}?subject=Myble order ${order.order_no}`}>{order.email}</a> : "—"}
            />
            <Field label="Phone" value={order.phone} />
            <Field label="Delivery" value={order.delivery_method} />
            <Field label="Street" value={order.street} />
            <Field label="City" value={order.city ? `${order.zip ?? ""} ${order.city}`.trim() : "—"} />
            <Field label="Country" value={order.country} />
          </dl>
        </Section>

        <Section title="Money">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Kit price" value={formatCzk(order.kit_price_czk)} />
            <Field label="Total" value={<span className="text-lg font-semibold">{formatCzk(order.total_price_czk)}</span>} />
          </dl>
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Consent record (B4)</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              <Field label="Accepted at" value={formatDate(order.accepted_at)} />
              <Field
                label="§1837 withdrawal ack."
                value={order.acknowledged_custom_withdrawal_exclusion ? "Yes ✓" : "NO — check!"}
              />
              <Field
                label="Doc versions"
                value={
                  <span className="font-mono text-xs">
                    {Object.entries(order.accepted_doc_versions ?? {})
                      .map(([k, v]) => `${k}@${v}`)
                      .join(", ") || "—"}
                  </span>
                }
              />
            </dl>
          </div>
        </Section>
      </div>

      {/* The production hand-off and the piece it makes, side by side and the
          same height: everything but the files you actually download starts
          folded away, and the 3D preview stretches to whatever that leaves. */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <Section title="Product & production data" fill>
          <div className="space-y-4">
            {design ? (
              <MebleProduction items={[{ ref: order.order_no, design }]} query={`ids=${order.id}`} bare />
            ) : (
              <p className="text-sm text-zinc-500">No readable design on this order — nothing to send to meble.pl.</p>
            )}
            <details className="rounded-xl border border-zinc-200">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
                Raw order data (JSON)
              </summary>
              <div className="space-y-3 border-t border-zinc-100 p-4">
                <JsonBlock title="Order summary (design_spec)" data={order.design_spec} />
                {order.design ? <JsonBlock title="Full design JSON — cut-list source of truth" data={order.design} /> : null}
                {order.custom_specification ? <JsonBlock title="Custom specification (§1837 proof)" data={order.custom_specification} /> : null}
              </div>
            </details>
          </div>
        </Section>

        <Section title="Design" fill>
          {design ? (
            <OrderDesignViewer design={design} orderNo={order.order_no} />
          ) : (
            <p className="text-sm text-zinc-500">No readable design on this order.</p>
          )}
        </Section>
      </div>

      <Section title="Audit trail">
        <dl className="grid grid-cols-2 gap-4">
          <Field label="IP" value={order.ip} />
          <Field label="User agent" value={<span className="break-all text-xs">{order.user_agent ?? "—"}</span>} />
        </dl>
      </Section>
    </div>
  );
}
