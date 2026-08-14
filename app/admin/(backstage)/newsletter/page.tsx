import { fetchSubscribers, isWithinDays } from "@/lib/backstageData";
import { EmptyState, ExportButton, formatDate, Kpi } from "@/components/admin/ui";

export default async function BackstageNewsletter() {
  const subscribers = await fetchSubscribers();
  const active = subscribers.filter((s) => !s.unsubscribed_at);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Newsletter</h1>
          <p className="mt-1 text-sm text-zinc-500">Subscribers captured on the site, synced to Resend.</p>
        </div>
        <ExportButton what="newsletter" />
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Active" value={active.length} />
        <Kpi label="Unsubscribed" value={subscribers.length - active.length} />
        <Kpi label="New (30 days)" value={subscribers.filter((s) => isWithinDays(s.created_at, 30)).length} />
        <Kpi
          label="Synced to Resend"
          value={subscribers.filter((s) => s.resend_contact_id).length}
          hint={`of ${subscribers.length} total`}
        />
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-zinc-200">
        {subscribers.length === 0 ? (
          <div className="p-5"><EmptyState text="No subscribers yet." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-3 font-medium">E-mail</th>
                  <th className="px-3 py-3 font-medium">Locale</th>
                  <th className="px-3 py-3 font-medium">Source</th>
                  <th className="px-3 py-3 font-medium">Consented</th>
                  <th className="px-3 py-3 font-medium">Resend</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-5 py-2.5 font-medium text-zinc-800">{s.email}</td>
                    <td className="px-3 py-2.5 uppercase text-zinc-600">{s.locale}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{s.source}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{formatDate(s.consented_at)}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{s.resend_contact_id ? "✓" : "—"}</td>
                    <td className="px-5 py-2.5">
                      {s.unsubscribed_at ? (
                        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 ring-1 ring-inset ring-zinc-500/20">
                          unsubscribed {formatDate(s.unsubscribed_at, false)}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          active
                        </span>
                      )}
                    </td>
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
