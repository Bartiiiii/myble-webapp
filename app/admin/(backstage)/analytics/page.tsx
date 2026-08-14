import Link from "next/link";
import {
  analyticsConfigured,
  fetchAnalyticsSnapshot,
  parseRange,
  posthogProjectUrl,
  type AnalyticsSnapshot,
  type RangeDays,
} from "@/lib/backstageAnalytics";
import { CHART_COLORS, EmptyState, Kpi, Section } from "@/components/admin/ui";
import {
  DeltaKpi,
  DonutChart,
  FunnelChart,
  InteractiveBars,
  RankedList,
} from "@/components/admin/charts";

export const dynamic = "force-dynamic";

const RANGES: { days: RangeDays; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Fill missing days with zeros so quiet days don't silently disappear. */
function fillDays(
  rangeDays: number,
  rows: { day: string; values: number[] }[],
  seriesCount: number,
): { label: string; values: number[] }[] {
  const byDay = new Map(rows.map((r) => [r.day, r.values]));
  const out: { label: string; values: number[] }[] = [];
  const today = new Date();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ label: iso, values: byDay.get(iso) ?? Array(seriesCount).fill(0) });
  }
  return out;
}

function RangeSwitcher({ active }: { active: RangeDays }) {
  return (
    <div className="inline-flex rounded-xl bg-zinc-100 p-1" role="group" aria-label="Date range">
      {RANGES.map((r) => (
        <Link
          key={r.days}
          href={`/admin/analytics?range=${r.days}`}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            active === r.days
              ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
          aria-current={active === r.days ? "page" : undefined}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}

const POSTHOG_LINKS = [
  { label: "Web analytics", path: "/web" },
  { label: "Dashboards", path: "/dashboard" },
  { label: "Session replay", path: "/replay/home" },
  { label: "Error tracking", path: "/error_tracking" },
  { label: "Heatmaps", path: "/heatmaps" },
  { label: "Surveys", path: "/surveys" },
];

export default async function BackstageAnalytics({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseRange((await searchParams).range);
  const s: AnalyticsSnapshot = await fetchAnalyticsSnapshot(range);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500">Live from PostHog (EU project), last {range} days.</p>
        </div>
        <div className="flex items-center gap-3">
          <RangeSwitcher active={range} />
          <a
            href={posthogProjectUrl}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Open PostHog ↗
          </a>
        </div>
      </header>

      {!analyticsConfigured ? (
        <Section title="Connect PostHog">
          <div className="space-y-3 text-sm text-zinc-700">
            <p>
              The backstage queries PostHog server-side, which needs a <strong>personal API key</strong>{" "}
              (the public project token can only send events, not read them).
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Open{" "}
                <a
                  className="text-indigo-600 hover:text-indigo-500"
                  href={`${posthogProjectUrl.replace(/\/project\/.*$/, "")}/settings/user-api-keys`}
                  target="_blank"
                >
                  PostHog → Settings → Personal API keys
                </a>{" "}
                and create a key with the <em>Query read</em> scope.
              </li>
              <li>
                Add{" "}
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
                  POSTHOG_PERSONAL_API_KEY=…
                </code>{" "}
                to <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">.env.local</code> and
                to Vercel env vars.
              </li>
              <li>Redeploy / restart — this page lights up automatically.</li>
            </ol>
          </div>
        </Section>
      ) : (
        <>
          {/* ── KPI row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <DeltaKpi
              label="Unique visitors"
              value={new Intl.NumberFormat("en").format(s.totals?.visitors ?? 0)}
              current={s.totals?.visitors}
              prev={s.totals?.prevVisitors}
            />
            <DeltaKpi
              label="Pageviews"
              value={new Intl.NumberFormat("en").format(s.totals?.pageviews ?? 0)}
              current={s.totals?.pageviews}
              prev={s.totals?.prevPageviews}
            />
            <DeltaKpi
              label="Sessions"
              value={new Intl.NumberFormat("en").format(s.sessionStats?.sessions ?? 0)}
              current={s.sessionStats?.sessions}
              prev={s.sessionStats?.prevSessions}
            />
            <DeltaKpi
              label="Avg session"
              value={formatDuration(s.sessionStats?.avgDurationS ?? 0)}
              current={s.sessionStats?.avgDurationS}
              prev={s.sessionStats?.prevAvgDurationS}
            />
            <DeltaKpi
              label="Bounce rate"
              value={s.sessionStats ? `${s.sessionStats.bouncePct}%` : "—"}
              current={s.sessionStats?.bouncePct}
              prev={s.sessionStats?.prevBouncePct}
              downIsGood
            />
            <Kpi
              label="Views / visitor"
              value={
                s.totals && s.totals.visitors > 0
                  ? (s.totals.pageviews / s.totals.visitors).toFixed(1)
                  : "—"
              }
            />
          </div>

          {/* ── Traffic ─────────────────────────────────────────────────── */}
          <Section title={`Traffic — last ${range} days`}>
            {!s.traffic || s.traffic.length === 0 ? (
              <EmptyState text="No pageview data in this range yet." />
            ) : (
              <InteractiveBars
                data={fillDays(
                  range,
                  s.traffic.map((t) => ({ day: t.day, values: [t.pageviews, t.visitors] })),
                  2,
                )}
                series={[
                  { name: "Pageviews", color: CHART_COLORS[0] },
                  { name: "Unique visitors", color: CHART_COLORS[1] },
                ]}
                labelKind="date"
                height={190}
              />
            )}
          </Section>

          {/* ── Funnel ──────────────────────────────────────────────────── */}
          <Section title="Conversion funnel — visit → configure → order">
            {!s.funnel ? (
              <EmptyState text="Funnel unavailable." />
            ) : (
              <FunnelChart
                steps={[
                  { label: "Visited", value: s.funnel.visited },
                  { label: "Configured", value: s.funnel.configured },
                  { label: "Started order", value: s.funnel.orderStarted },
                  { label: "Placed order", value: s.funnel.orderPlaced },
                ]}
              />
            )}
          </Section>

          {/* ── Pages & acquisition ─────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Top pages">
              {!s.topPages || s.topPages.length === 0 ? (
                <EmptyState text="No data yet." />
              ) : (
                <RankedList items={s.topPages} unit="views" />
              )}
            </Section>
            <Section title="Referrers">
              {!s.referrers || s.referrers.length === 0 ? (
                <EmptyState text="No data yet." />
              ) : (
                <RankedList items={s.referrers} unit="sessions" color={CHART_COLORS[1]} />
              )}
            </Section>
            <Section title="Entry pages — where sessions start">
              {!s.entryPages || s.entryPages.length === 0 ? (
                <EmptyState text="No data yet." />
              ) : (
                <RankedList items={s.entryPages} unit="sessions" />
              )}
            </Section>
            <Section title="Channels">
              {!s.channels || s.channels.length === 0 ? (
                <EmptyState text="No data yet." />
              ) : (
                <RankedList items={s.channels} unit="sessions" color={CHART_COLORS[1]} />
              )}
            </Section>
          </div>

          {/* ── Audience ────────────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Devices">
              {!s.devices || s.devices.length === 0 ? (
                <EmptyState text="No data yet." />
              ) : (
                <DonutChart items={s.devices} unit="visitors" />
              )}
            </Section>
            <Section title="Browsers">
              {!s.browsers || s.browsers.length === 0 ? (
                <EmptyState text="No data yet." />
              ) : (
                <RankedList items={s.browsers} unit="visitors" color={CHART_COLORS[2]} />
              )}
            </Section>
            <Section title="Countries">
              {!s.countries || s.countries.length === 0 ? (
                <EmptyState text="No data yet." />
              ) : (
                <RankedList items={s.countries} unit="visitors" color={CHART_COLORS[3]} />
              )}
            </Section>
          </div>

          {/* ── Newsletter & rhythm ─────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Newsletter — signups vs unsubscribes">
              {!s.newsletter || s.newsletter.length === 0 ? (
                <EmptyState text="No newsletter activity in this range." />
              ) : (
                <InteractiveBars
                  data={fillDays(
                    range,
                    s.newsletter.map((d) => ({ day: d.day, values: [d.subscribed, d.unsubscribed] })),
                    2,
                  )}
                  series={[
                    { name: "Subscribed", color: CHART_COLORS[1] },
                    { name: "Unsubscribed", color: CHART_COLORS[3] },
                  ]}
                  labelKind="date"
                  height={150}
                />
              )}
            </Section>
            <Section title="Activity by hour (UTC)">
              {!s.hourly ? (
                <EmptyState text="No data yet." />
              ) : (
                <InteractiveBars
                  data={s.hourly.map((h) => ({ label: h.label, values: [h.value] }))}
                  series={[{ name: "Pageviews", color: CHART_COLORS[0] }]}
                  height={150}
                />
              )}
            </Section>
          </div>

          {/* ── Events & health ─────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Top events">
              {!s.topEvents || s.topEvents.length === 0 ? (
                <EmptyState text="No custom events in this range." />
              ) : (
                <RankedList items={s.topEvents} unit="times" />
              )}
            </Section>
            <Section
              title="Site health"
              action={
                <a
                  href={`${posthogProjectUrl}/error_tracking`}
                  target="_blank"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Error tracking ↗
                </a>
              }
            >
              {!s.health ? (
                <EmptyState text="No data yet." />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <DeltaKpi
                    label="JS exceptions"
                    value={new Intl.NumberFormat("en").format(s.health.exceptions)}
                    current={s.health.exceptions}
                    prev={s.health.prevExceptions}
                    downIsGood
                  />
                  <DeltaKpi
                    label="Rage clicks"
                    value={new Intl.NumberFormat("en").format(s.health.rageclicks)}
                    current={s.health.rageclicks}
                    prev={s.health.prevRageclicks}
                    downIsGood
                  />
                  <div className="col-span-2">
                    <Kpi
                      label="LCP p75 (web vitals)"
                      value={s.health.lcpP75Ms !== null ? `${(s.health.lcpP75Ms / 1000).toFixed(2)}s` : "—"}
                      hint={
                        s.health.lcpP75Ms !== null
                          ? s.health.lcpP75Ms <= 2500
                            ? "Good — under the 2.5s threshold"
                            : "Needs improvement — over 2.5s"
                          : "Collected as sessions come in"
                      }
                    />
                  </div>
                </div>
              )}
            </Section>
          </div>

          {/* ── Deep links ──────────────────────────────────────────────── */}
          <Section title="Explore in PostHog">
            <div className="flex flex-wrap gap-2">
              {POSTHOG_LINKS.map((l) => (
                <a
                  key={l.path}
                  href={`${posthogProjectUrl}${l.path}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  {l.label} ↗
                </a>
              ))}
            </div>
          </Section>

          {s.errors.length > 0 ? (
            <p className="text-xs text-zinc-400">
              Some sections could not load: {s.errors.join(" · ")}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
