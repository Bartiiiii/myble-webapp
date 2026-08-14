import { fetchDesigns, isWithinDays } from "@/lib/backstageData";
import { EmptyState, ExportButton, formatDate, Kpi } from "@/components/admin/ui";

export default async function BackstageDesigns() {
  const designs = await fetchDesigns();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shared designs</h1>
          <p className="mt-1 text-sm text-zinc-500">Configurations customers saved or shared via /design?d=…</p>
        </div>
        <ExportButton what="designs" />
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Kpi label="Total" value={designs.length} />
        <Kpi label="New (30 days)" value={designs.filter((d) => isWithinDays(d.created_at, 30)).length} />
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-zinc-200">
        {designs.length === 0 ? (
          <div className="p-5"><EmptyState text="No shared designs yet." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-3 font-medium">Slug</th>
                  <th className="px-3 py-3 font-medium">Locale</th>
                  <th className="px-3 py-3 font-medium">Source</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Open</th>
                </tr>
              </thead>
              <tbody>
                {designs.map((d) => (
                  <tr key={d.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-5 py-2.5 font-mono text-xs text-zinc-800">{d.slug}</td>
                    <td className="px-3 py-2.5 uppercase text-zinc-600">{d.locale}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{d.source}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{formatDate(d.created_at)}</td>
                    <td className="px-5 py-2.5">
                      <a
                        href={`/design?d=${d.slug}`}
                        target="_blank"
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        Open in configurator ↗
                      </a>
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
