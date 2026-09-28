import { fetchUsers } from "@/lib/community";
import { Avatar } from "@/components/Avatar";
import { EmptyState, formatDate, Kpi } from "@/components/admin/ui";
import { isWithinDays } from "@/lib/backstageData";

// Everyone in the community: real Google sign-ins plus the seeded house
// designers the curated library is credited to.
//
// A profile row is created the first time somebody signs in (see
// /api/profile), so this is the honest list of who has an account — not a
// guess assembled from orders or newsletter subscribers, both of which are
// free-text e-mail, not identity.

export const dynamic = "force-dynamic";

export default async function BackstageUsers() {
  const users = await fetchUsers();
  const real = users.filter((u) => !u.is_seed);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Everyone who has signed in, plus the seeded designers behind the curated library.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Signed-up users" value={real.length} />
        <Kpi label="New (30 days)" value={real.filter((u) => isWithinDays(u.created_at, 30)).length} />
        <Kpi label="Active (7 days)" value={real.filter((u) => isWithinDays(u.last_seen_at, 7)).length} />
        <Kpi label="Seeded designers" value={users.length - real.length} />
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-zinc-200">
        {users.length === 0 ? (
          <div className="p-5">
            <EmptyState text="No profiles yet. They appear the first time somebody signs in." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-3 font-medium">Person</th>
                  <th className="px-3 py-3 font-medium">E-mail</th>
                  <th className="px-3 py-3 font-medium text-right">Followers</th>
                  <th className="px-3 py-3 font-medium text-right">In library</th>
                  <th className="px-3 py-3 font-medium text-right">Awaiting review</th>
                  <th className="px-3 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-5 py-2.5">
                      <a
                        href={`/u/${u.handle}`}
                        target="_blank"
                        className="group flex items-center gap-2.5"
                        title="Open public profile"
                      >
                        <Avatar
                          person={{
                            name: u.display_name,
                            handle: u.handle,
                            avatarUrl: u.avatar_url,
                            avatarColor: u.avatar_color,
                          }}
                          size="sm"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-900 group-hover:text-indigo-600">
                            {u.display_name}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-zinc-400">@{u.handle}</span>
                        </span>
                        {u.is_seed && (
                          <span className="ml-1 shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                            seed
                          </span>
                        )}
                        {!u.is_seed && u.onboarded_at === null && (
                          <span className="ml-1 shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            setup pending
                          </span>
                        )}
                      </a>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600">{u.email ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">{u.followers}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">{u.published}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">
                      {u.submitted > 0 ? (
                        <span className="font-semibold text-amber-700">{u.submitted}</span>
                      ) : (
                        u.submitted
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600">{formatDate(u.created_at, false)}</td>
                    <td className="px-5 py-2.5 text-zinc-600">{u.is_seed ? "—" : formatDate(u.last_seen_at)}</td>
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
