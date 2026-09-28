import Link from "next/link";
import { fetchSubmissions, type ShareStatus } from "@/lib/community";
import { EmptyState, Kpi } from "@/components/admin/ui";
import { SubmissionCard, type Submission } from "@/components/admin/SubmissionCard";
import type { Design } from "@/lib/model";

// Backstage → Designs is the APPROVAL QUEUE for the public Design Library.
//
// It used to list every row in the `designs` table, which meant every
// throwaway configuration a customer saved or sent themselves a link to —
// hundreds of private snapshots nobody needs to look at. What actually needs a
// human is the small set people deliberately shared with the community, and
// none of those go live until they are approved here.
//
// Private saves are still in the table (My Account → My Designs); they simply
// aren't this page's business.

export const dynamic = "force-dynamic";

const FILTERS: { id: ShareStatus | "all"; label: string }[] = [
  { id: "pending", label: "Waiting for review" },
  { id: "published", label: "Live in library" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All submissions" },
];

export default async function BackstageDesigns({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = (FILTERS.find((f) => f.id === status)?.id ?? "pending") as ShareStatus | "all";

  const all = await fetchSubmissions();
  const shown = active === "all" ? all : all.filter((d) => d.share_status === active);

  const pending = all.filter((d) => d.share_status === "pending").length;
  const published = all.filter((d) => d.share_status === "published").length;
  const rejected = all.filter((d) => d.share_status === "rejected").length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Design library submissions</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Designs customers shared with the community. Nothing appears in the public library until you approve it here.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Waiting for review" value={pending} />
        <Kpi label="Live in library" value={published} />
        <Kpi label="Rejected" value={rejected} />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "pending" ? "/admin/designs" : `/admin/designs?status=${f.id}`}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 transition ${
              active === f.id
                ? "bg-zinc-900 text-white ring-zinc-900"
                : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
          <EmptyState text="Nothing here right now." />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((d) => (
            <SubmissionCard
              key={d.id}
              item={
                {
                  id: d.id,
                  slug: d.slug,
                  title: d.title,
                  note: d.note,
                  category: d.category,
                  categoryCustom: d.category_custom,
                  design: d.design as Design,
                  share_status: d.share_status,
                  submitted_at: d.submitted_at,
                  reviewed_at: d.reviewed_at,
                  user_email: d.user_email,
                  author: d.author,
                } satisfies Submission
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
