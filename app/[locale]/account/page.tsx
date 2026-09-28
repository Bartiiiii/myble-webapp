"use client";

import Link from "../../../lib/localeNav";
import React from "react";
import { useSession } from "next-auth/react";
import { useT } from "../../../lib/i18n";

// lib/i18n.tsx is client-only (locale lives in localStorage/a cookie, no URL
// routing), so this — like every other translated page in the app — is a
// client component. It fetches from /api/account/* and /api/profile (both
// server-scoped by the session) rather than calling the service-role Supabase
// client directly, which must never run in browser code.
export default function AccountOverview() {
  const t = useT();
  const { data: session } = useSession();
  const [designCount, setDesignCount] = React.useState<number | null>(null);
  const [orderCount, setOrderCount] = React.useState<number | null>(null);
  const [followers, setFollowers] = React.useState<number | null>(null);
  const [handle, setHandle] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/account/designs").then((r) => r.json()),
      fetch("/api/account/orders").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ]).then(([d, o, p]) => {
      if (cancelled) return;
      setDesignCount(d?.ok ? d.designs.length : 0);
      setOrderCount(o?.ok ? o.orders.length : 0);
      setFollowers(p?.ok ? p.followers : 0);
      setHandle(p?.ok ? p.profile.handle : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = session?.user?.name ?? session?.user?.email ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("account.overview.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("account.overview.greeting", { name })}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/account/designs" className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200 transition hover:ring-zinc-300">
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{designCount ?? "…"}</p>
          <p className="mt-1 text-sm text-zinc-600">{t("account.overview.designsCount", { n: designCount ?? 0 })}</p>
          <p className="mt-3 text-sm font-semibold text-indigo-600">{t("account.overview.designsCta")}</p>
        </Link>

        <Link href="/account/orders" className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200 transition hover:ring-zinc-300">
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{orderCount ?? "…"}</p>
          <p className="mt-1 text-sm text-zinc-600">{t("account.overview.ordersCount", { n: orderCount ?? 0 })}</p>
          <p className="mt-3 text-sm font-semibold text-indigo-600">{t("account.overview.ordersCta")}</p>
        </Link>

        {/* Followers — the one number that is about other people rather than
            your own stuff, so it gets the loud treatment on the right. */}
        <Link
          href={handle ? `/u/${handle}` : "/account/settings"}
          className="rounded-2xl bg-zinc-900 p-6 text-white transition hover:bg-zinc-800 sm:col-span-2 lg:col-span-1"
        >
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{followers ?? "…"}</p>
          <p className="mt-1 text-sm text-zinc-300">{t("account.overview.followersCount", { n: followers ?? 0 })}</p>
          <p className="mt-3 text-sm font-semibold text-indigo-300">{t("account.overview.followersCta")}</p>
        </Link>
      </div>
    </div>
  );
}
