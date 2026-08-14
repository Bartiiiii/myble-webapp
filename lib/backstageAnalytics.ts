// PostHog analytics for the backstage, queried server-side over the HogQL
// query API. Needs a PERSONAL API key (not the public project token):
// PostHog → Settings → Personal API keys → create with "Query read" scope,
// then set POSTHOG_PERSONAL_API_KEY (and optionally POSTHOG_PROJECT_ID).
//
// Every section is fetched independently (Promise.allSettled), so one failing
// query degrades that section only — the rest of the dashboard still renders.

const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com").replace(/\/$/, "");
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "211145";
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;

export const posthogProjectUrl = `${HOST}/project/${PROJECT_ID}`;
export const analyticsConfigured = Boolean(API_KEY);

export type RangeDays = 7 | 30 | 90;

export function parseRange(raw: string | undefined): RangeDays {
  if (raw === "7") return 7;
  if (raw === "90") return 90;
  return 30;
}

type HogQLRow = (string | number | null)[];

const QUERY_TIMEOUT_MS = 15_000;

async function hogql(query: string): Promise<HogQLRow[]> {
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    cache: "no-store",
    // Without this, one hung connection stalls the whole page render until the
    // OS socket timeout (~5 min). A missed section degrades gracefully instead.
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`PostHog query failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { results?: HogQLRow[] };
  return json.results ?? [];
}

/** Run tasks with bounded concurrency so we don't burst-slam the query API. */
async function pooledSettled<T>(
  tasks: (() => Promise<T>)[],
  limit = 6,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

const num = (v: string | number | null | undefined): number => Number(v ?? 0) || 0;
const str = (v: string | number | null | undefined, fallback = "Unknown"): string => {
  const s = String(v ?? "").trim();
  return s === "" ? fallback : s;
};

// ── Section shapes ───────────────────────────────────────────────────────────

export interface TrafficDay {
  day: string;
  pageviews: number;
  visitors: number;
  sessions: number;
}

export interface Slice {
  label: string;
  value: number;
}

export interface Totals {
  pageviews: number;
  visitors: number;
  prevPageviews: number;
  prevVisitors: number;
}

export interface SessionStats {
  sessions: number;
  avgDurationS: number;
  bouncePct: number;
  prevSessions: number;
  prevAvgDurationS: number;
  prevBouncePct: number;
}

export interface FunnelSteps {
  visited: number;
  configured: number;
  orderStarted: number;
  orderPlaced: number;
}

export interface NewsletterDay {
  day: string;
  subscribed: number;
  unsubscribed: number;
}

export interface HealthStats {
  exceptions: number;
  rageclicks: number;
  prevExceptions: number;
  prevRageclicks: number;
  lcpP75Ms: number | null;
}

export interface AnalyticsSnapshot {
  rangeDays: RangeDays;
  traffic: TrafficDay[] | null;
  totals: Totals | null;
  sessionStats: SessionStats | null;
  topPages: Slice[] | null;
  entryPages: Slice[] | null;
  referrers: Slice[] | null;
  channels: Slice[] | null;
  devices: Slice[] | null;
  browsers: Slice[] | null;
  countries: Slice[] | null;
  topEvents: Slice[] | null;
  funnel: FunnelSteps | null;
  newsletter: NewsletterDay[] | null;
  hourly: Slice[] | null;
  health: HealthStats | null;
  errors: string[];
}

// ── Snapshot ─────────────────────────────────────────────────────────────────

// Events instrumented in the configurator flow. Some have not fired yet — they
// count 0 until traffic reaches that step, which is exactly what a funnel shows.
const CONFIGURE_EVENTS =
  "'part_added','preset_applied','colour_selected','thickness_selected','cut_list_downloaded'";
const ORDER_START_EVENTS = "'order_initiated','order_login_initiated','order_login_skipped'";

interface SectionSpec {
  name: string;
  query: string;
  apply: (rows: HogQLRow[], out: AnalyticsSnapshot) => void;
}

export async function fetchAnalyticsSnapshot(rangeDays: RangeDays): Promise<AnalyticsSnapshot> {
  const empty: AnalyticsSnapshot = {
    rangeDays,
    traffic: null,
    totals: null,
    sessionStats: null,
    topPages: null,
    entryPages: null,
    referrers: null,
    channels: null,
    devices: null,
    browsers: null,
    countries: null,
    topEvents: null,
    funnel: null,
    newsletter: null,
    hourly: null,
    health: null,
    errors: [],
  };
  if (!API_KEY) return empty;

  const R = `INTERVAL ${rangeDays} DAY`;
  const R2 = `INTERVAL ${rangeDays * 2} DAY`;

  const sections: SectionSpec[] = [
    {
      name: "traffic",
      query: `SELECT toDate(timestamp) AS day, count() AS pv, uniq(person_id) AS visitors, uniq(properties.$session_id) AS sessions
              FROM events WHERE event = '$pageview' AND timestamp > now() - ${R}
              GROUP BY day ORDER BY day`,
      apply: (rows, out) => {
        out.traffic = rows.map((r) => ({
          day: String(r[0]),
          pageviews: num(r[1]),
          visitors: num(r[2]),
          sessions: num(r[3]),
        }));
      },
    },
    {
      name: "totals",
      query: `SELECT countIf(timestamp > now() - ${R}) AS pv,
                     uniqIf(person_id, timestamp > now() - ${R}) AS visitors,
                     countIf(timestamp <= now() - ${R}) AS prev_pv,
                     uniqIf(person_id, timestamp <= now() - ${R}) AS prev_visitors
              FROM events WHERE event = '$pageview' AND timestamp > now() - ${R2}`,
      apply: (rows, out) => {
        const r = rows[0] ?? [];
        out.totals = {
          pageviews: num(r[0]),
          visitors: num(r[1]),
          prevPageviews: num(r[2]),
          prevVisitors: num(r[3]),
        };
      },
    },
    {
      name: "sessionStats",
      query: `SELECT if($start_timestamp > now() - ${R}, 'cur', 'prev') AS period,
                     count() AS sessions,
                     round(avg($session_duration)) AS avg_s,
                     round(100 * countIf($is_bounce) / count(), 1) AS bounce
              FROM sessions WHERE $start_timestamp > now() - ${R2}
              GROUP BY period`,
      apply: (rows, out) => {
        const cur = rows.find((r) => r[0] === "cur");
        const prev = rows.find((r) => r[0] === "prev");
        out.sessionStats = {
          sessions: num(cur?.[1]),
          avgDurationS: num(cur?.[2]),
          bouncePct: num(cur?.[3]),
          prevSessions: num(prev?.[1]),
          prevAvgDurationS: num(prev?.[2]),
          prevBouncePct: num(prev?.[3]),
        };
      },
    },
    {
      name: "topPages",
      query: `SELECT properties.$pathname AS path, count() AS views
              FROM events WHERE event = '$pageview' AND timestamp > now() - ${R}
              GROUP BY path ORDER BY views DESC LIMIT 10`,
      apply: (rows, out) => {
        out.topPages = rows.map((r) => ({ label: str(r[0], "?"), value: num(r[1]) }));
      },
    },
    {
      name: "entryPages",
      query: `SELECT $entry_pathname AS path, count() AS s
              FROM sessions WHERE $start_timestamp > now() - ${R}
              GROUP BY path ORDER BY s DESC LIMIT 8`,
      apply: (rows, out) => {
        out.entryPages = rows.map((r) => ({ label: str(r[0], "?"), value: num(r[1]) }));
      },
    },
    {
      name: "referrers",
      query: `SELECT if($entry_referring_domain = '$direct' OR $entry_referring_domain = '', 'Direct', $entry_referring_domain) AS ref, count() AS s
              FROM sessions WHERE $start_timestamp > now() - ${R}
              GROUP BY ref ORDER BY s DESC LIMIT 8`,
      apply: (rows, out) => {
        out.referrers = rows.map((r) => ({ label: str(r[0], "Direct"), value: num(r[1]) }));
      },
    },
    {
      name: "channels",
      query: `SELECT coalesce(nullif($channel_type, ''), 'Unknown') AS ch, count() AS s
              FROM sessions WHERE $start_timestamp > now() - ${R}
              GROUP BY ch ORDER BY s DESC LIMIT 8`,
      apply: (rows, out) => {
        out.channels = rows.map((r) => ({ label: str(r[0]), value: num(r[1]) }));
      },
    },
    {
      name: "devices",
      query: `SELECT coalesce(properties.$device_type, 'Unknown') AS d, uniq(person_id) AS visitors
              FROM events WHERE event = '$pageview' AND timestamp > now() - ${R}
              GROUP BY d ORDER BY visitors DESC LIMIT 6`,
      apply: (rows, out) => {
        out.devices = rows.map((r) => ({ label: str(r[0]), value: num(r[1]) }));
      },
    },
    {
      name: "browsers",
      query: `SELECT coalesce(properties.$browser, 'Unknown') AS b, uniq(person_id) AS visitors
              FROM events WHERE event = '$pageview' AND timestamp > now() - ${R}
              GROUP BY b ORDER BY visitors DESC LIMIT 8`,
      apply: (rows, out) => {
        out.browsers = rows.map((r) => ({ label: str(r[0]), value: num(r[1]) }));
      },
    },
    {
      name: "countries",
      query: `SELECT coalesce(properties.$geoip_country_name, 'Unknown') AS c, uniq(person_id) AS visitors
              FROM events WHERE event = '$pageview' AND timestamp > now() - ${R}
              GROUP BY c ORDER BY visitors DESC LIMIT 8`,
      apply: (rows, out) => {
        out.countries = rows.map((r) => ({ label: str(r[0]), value: num(r[1]) }));
      },
    },
    {
      name: "topEvents",
      query: `SELECT event, count() AS c
              FROM events WHERE timestamp > now() - ${R} AND event NOT LIKE '$%'
              GROUP BY event ORDER BY c DESC LIMIT 12`,
      apply: (rows, out) => {
        out.topEvents = rows.map((r) => ({ label: str(r[0], "?"), value: num(r[1]) }));
      },
    },
    {
      name: "funnel",
      query: `SELECT uniqIf(person_id, event = '$pageview') AS visited,
                     uniqIf(person_id, event IN (${CONFIGURE_EVENTS})) AS configured,
                     uniqIf(person_id, event IN (${ORDER_START_EVENTS})) AS order_started,
                     uniqIf(person_id, event = 'order_placed') AS order_placed
              FROM events WHERE timestamp > now() - ${R}`,
      apply: (rows, out) => {
        const r = rows[0] ?? [];
        out.funnel = {
          visited: num(r[0]),
          configured: num(r[1]),
          orderStarted: num(r[2]),
          orderPlaced: num(r[3]),
        };
      },
    },
    {
      name: "newsletter",
      query: `SELECT toDate(timestamp) AS day,
                     countIf(event IN ('newsletter_subscribed', 'newsletter_resubscribed')) AS subs,
                     countIf(event = 'newsletter_unsubscribed') AS unsubs
              FROM events
              WHERE timestamp > now() - ${R}
                AND event IN ('newsletter_subscribed', 'newsletter_resubscribed', 'newsletter_unsubscribed')
              GROUP BY day ORDER BY day`,
      apply: (rows, out) => {
        out.newsletter = rows.map((r) => ({
          day: String(r[0]),
          subscribed: num(r[1]),
          unsubscribed: num(r[2]),
        }));
      },
    },
    {
      name: "hourly",
      query: `SELECT toHour(timestamp) AS h, count() AS pv
              FROM events WHERE event = '$pageview' AND timestamp > now() - ${R}
              GROUP BY h ORDER BY h`,
      apply: (rows, out) => {
        const byHour = new Map(rows.map((r) => [num(r[0]), num(r[1])]));
        out.hourly = Array.from({ length: 24 }, (_, h) => ({
          label: `${String(h).padStart(2, "0")}:00`,
          value: byHour.get(h) ?? 0,
        }));
      },
    },
    {
      name: "health",
      query: `SELECT countIf(event = '$exception' AND timestamp > now() - ${R}) AS exceptions,
                     countIf(event = '$rageclick' AND timestamp > now() - ${R}) AS rageclicks,
                     countIf(event = '$exception' AND timestamp <= now() - ${R}) AS prev_exceptions,
                     countIf(event = '$rageclick' AND timestamp <= now() - ${R}) AS prev_rageclicks
              FROM events WHERE timestamp > now() - ${R2} AND event IN ('$exception', '$rageclick')`,
      apply: (rows, out) => {
        const r = rows[0] ?? [];
        out.health = {
          exceptions: num(r[0]),
          rageclicks: num(r[1]),
          prevExceptions: num(r[2]),
          prevRageclicks: num(r[3]),
          lcpP75Ms: null,
        };
      },
    },
  ];

  const out: AnalyticsSnapshot = { ...empty };
  const results = await pooledSettled(sections.map((s) => () => hogql(s.query)));
  results.forEach((res, i) => {
    const section = sections[i];
    if (res.status === "fulfilled") {
      section.apply(res.value, out);
    } else {
      out.errors.push(
        `${section.name}: ${res.reason instanceof Error ? res.reason.message : String(res.reason)}`,
      );
    }
  });

  // Web vitals LCP p75 — separate because quantile over a sparse nullable
  // column can fail on some project states; a miss only blanks this one stat.
  try {
    const rows = await hogql(
      `SELECT round(quantile(0.75)($vitals_lcp)) FROM sessions
       WHERE $start_timestamp > now() - ${R} AND $vitals_lcp IS NOT NULL`,
    );
    const v = rows[0]?.[0];
    if (out.health && v !== null && v !== undefined && v !== "None") out.health.lcpP75Ms = num(v);
  } catch {
    // Non-essential stat; ignore.
  }

  return out;
}
