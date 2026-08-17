"use client";

import React from "react";
import { useT } from "../../../lib/i18n";
import { EmptyState, formatCzk, formatDate, StatusPill } from "../../../components/account/ui";

interface AccountOrder {
  order_no: string;
  created_at: string;
  status: string;
  delivery_method: string | null;
  city: string | null;
  total_price_czk: number | null;
}

export default function AccountOrders() {
  const t = useT();
  const [orders, setOrders] = React.useState<AccountOrder[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/account/orders")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body?.ok) setOrders(body.orders);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("account.orders.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("account.orders.disclaimer")}</p>
      </div>

      {orders === null ? null : orders.length === 0 ? (
        <EmptyState text={t("account.orders.empty")} hint={t("account.orders.emptyHint")} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-5 py-3 font-medium">{t("account.orders.orderNo")}</th>
                <th className="px-5 py-3 font-medium">{t("account.orders.placedOn")}</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">{t("account.orders.total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orders.map((o) => (
                <tr key={o.order_no}>
                  <td className="px-5 py-3.5 font-medium text-zinc-900">{o.order_no}</td>
                  <td className="px-5 py-3.5 text-zinc-600">{formatDate(o.created_at)}</td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={o.status} label={t(`account.orders.status.${o.status}`)} />
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-zinc-900">{formatCzk(o.total_price_czk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
