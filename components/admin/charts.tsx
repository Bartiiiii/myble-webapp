"use client";

import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Interactive backstage charts (client-side, hand-rolled SVG — no chart deps).
//
// Palette lives in ui.tsx (server-safe module) — importing it from this
// "use client" file would give server pages a proxy instead of the values.
// Series always keep their color; tooltips show exact values on hover/focus.
// ─────────────────────────────────────────────────────────────────────────────

import { CHART_COLORS } from "./ui";

const fmt = (n: number) => new Intl.NumberFormat("en").format(n);

// ── Tooltip shell ────────────────────────────────────────────────────────────

function TooltipCard({
  title,
  rows,
}: {
  title: string;
  rows: { color?: string; label: string; value: string }[];
}) {
  return (
    <div className="pointer-events-none min-w-36 rounded-xl bg-zinc-900 px-3 py-2 text-left shadow-lg">
      <p className="text-[11px] font-medium text-zinc-400">{title}</p>
      <div className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <p key={r.label} className="flex items-center gap-2 text-xs text-zinc-300">
            {r.color ? (
              <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
            ) : null}
            <span className="font-semibold tabular-nums text-white">{r.value}</span>
            <span className="truncate">{r.label}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Grouped day/hour bars with crosshair tooltip ─────────────────────────────

export interface BarsPoint {
  /** X label, e.g. "2026-07-18" or "14:00". */
  label: string;
  values: number[];
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

export function InteractiveBars({
  data,
  series,
  height = 176,
  labelKind = "raw",
}: {
  data: BarsPoint[];
  series: { name: string; color: string }[];
  height?: number;
  /** "date" prettifies ISO dates ("2026-07-18" → "18 Jul"); "raw" shows labels as-is. */
  labelKind?: "date" | "raw";
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const n = data.length;
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const pretty = labelKind === "date" ? prettyDate : (l: string) => l;

  // Recessive y gridlines at 25/50/75/100%.
  const gridFractions = [0.25, 0.5, 0.75, 1];

  function indexFromClientX(clientX: number): number | null {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const i = Math.floor(((clientX - rect.left) / rect.width) * n);
    return i >= 0 && i < n ? i : null;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      setHover((h) => Math.max(0, (h ?? n) - 1));
      e.preventDefault();
    } else if (e.key === "Escape") {
      setHover(null);
    }
  }

  if (n === 0) return null;
  const colPct = 100 / n;

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative outline-none"
        style={{ height }}
        tabIndex={0}
        role="img"
        aria-label={`Bar chart, ${n} points: ${series.map((s) => s.name).join(", ")}. Use arrow keys to inspect values.`}
        onPointerMove={(e) => setHover(indexFromClientX(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setHover(null)}
      >
        <svg viewBox={`0 0 100 100`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
          {gridFractions.map((f) => (
            <line
              key={f}
              x1="0"
              x2="100"
              y1={100 - f * 100}
              y2={100 - f * 100}
              stroke="#e4e4e7"
              strokeWidth="0.3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hover !== null ? (
            <rect x={hover * colPct} y="0" width={colPct} height="100" fill="#18181b" opacity="0.05" />
          ) : null}
          {data.map((d, i) => {
            const bandPad = colPct * 0.18;
            const innerW = colPct - bandPad * 2;
            const gap = series.length > 1 ? innerW * 0.08 : 0;
            const barW = (innerW - gap * (series.length - 1)) / series.length;
            return (
              <g key={d.label} opacity={hover === null || hover === i ? 1 : 0.55}>
                {d.values.map((v, s) => {
                  const h = (v / max) * 96;
                  const x = i * colPct + bandPad + s * (barW + gap);
                  return (
                    <rect
                      key={s}
                      x={x}
                      y={100 - h}
                      width={barW}
                      height={Math.max(h, v > 0 ? 0.75 : 0.3)}
                      rx="0.5"
                      fill={v > 0 ? series[s].color : "#d4d4d8"}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {hover !== null ? (
          <div
            className="absolute z-10"
            style={{
              left: `${(hover + 0.5) * colPct}%`,
              top: -8,
              transform: `translate(${hover > n / 2 ? "-100%" : "0"}, -100%) translateX(${hover > n / 2 ? "-8px" : "8px"})`,
            }}
          >
            <TooltipCard
              title={pretty(data[hover].label)}
              rows={series.map((s, si) => ({
                color: s.color,
                label: s.name,
                value: fmt(data[hover].values[si] ?? 0),
              }))}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span className="tabular-nums">{pretty(data[0].label)}</span>
        {series.length > 1 ? (
          <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {series.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[3px]" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </span>
        ) : null}
        <span className="tabular-nums">{pretty(data[n - 1].label)}</span>
      </div>
    </div>
  );
}

// ── Ranked horizontal bars with share tooltip ────────────────────────────────

export function RankedList({
  items,
  unit = "views",
  color = CHART_COLORS[0],
}: {
  items: { label: string; value: number }[];
  unit?: string;
  color?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((a, b) => a + b.value, 0);

  return (
    <ul className="space-y-1">
      {items.map((item, i) => {
        const share = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <li
            key={item.label}
            className="relative -mx-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none"
            tabIndex={0}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-zinc-800">{item.label}</span>
              <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                <span className="text-zinc-800">{fmt(item.value)}</span>
                <span className="w-11 text-right text-xs text-zinc-400">{share.toFixed(1)}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${(item.value / max) * 100}%`, background: color }}
              />
            </div>
            {hover === i ? (
              <div className="absolute right-2 top-0 z-10 -translate-y-full pb-1.5">
                <TooltipCard
                  title={item.label}
                  rows={[
                    { color, label: unit, value: fmt(item.value) },
                    { label: "share", value: `${share.toFixed(1)}%` },
                  ]}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// ── Donut with hover per segment ─────────────────────────────────────────────

export function DonutChart({
  items,
  unit = "visitors",
}: {
  items: { label: string; value: number }[];
  unit?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const total = items.reduce((a, b) => a + b.value, 0);
  if (total === 0) return null;

  // Fold anything beyond the fixed palette into "Other".
  const shown = items.slice(0, CHART_COLORS.length - 1);
  const rest = items.slice(CHART_COLORS.length - 1);
  const slices = [
    ...shown,
    ...(rest.length > 0 ? [{ label: "Other", value: rest.reduce((a, b) => a + b.value, 0) }] : []),
  ];

  const r = 15.915; // circumference ≈ 100 for easy dash math
  let acc = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          {slices.map((s, i) => {
            const pct = (s.value / total) * 100;
            const el = (
              <circle
                key={s.label}
                cx="21"
                cy="21"
                r={r}
                fill="none"
                stroke={CHART_COLORS[i]}
                strokeWidth={hover === i ? 7.5 : 6}
                strokeDasharray={`${Math.max(pct - 1.2, 0.4)} ${100 - Math.max(pct - 1.2, 0.4)}`}
                strokeDashoffset={-acc}
                className="cursor-pointer transition-all"
                opacity={hover === null || hover === i ? 1 : 0.4}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            );
            acc += pct;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hover !== null ? (
            <>
              <span className="text-lg font-semibold tabular-nums text-zinc-900">
                {((slices[hover].value / total) * 100).toFixed(1)}%
              </span>
              <span className="max-w-24 truncate text-xs text-zinc-500">{slices[hover].label}</span>
            </>
          ) : (
            <>
              <span className="text-lg font-semibold tabular-nums text-zinc-900">{fmt(total)}</span>
              <span className="text-xs text-zinc-500">{unit}</span>
            </>
          )}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <li
            key={s.label}
            className={`flex cursor-default items-center justify-between gap-3 rounded-lg px-2 py-1 text-sm transition-colors ${hover === i ? "bg-zinc-50" : ""}`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: CHART_COLORS[i] }} />
              <span className="truncate text-zinc-700">{s.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-zinc-800">
              {fmt(s.value)}
              <span className="ml-1.5 inline-block w-11 text-right text-xs text-zinc-400">
                {((s.value / total) * 100).toFixed(1)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Conversion funnel ────────────────────────────────────────────────────────

export function FunnelChart({ steps }: { steps: { label: string; value: number }[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const first = steps[0]?.value ?? 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, i) => {
        const prev = i === 0 ? step.value : steps[i - 1].value;
        const stepPct = prev > 0 ? (step.value / prev) * 100 : 0;
        const overallPct = first > 0 ? (step.value / first) * 100 : 0;
        const barPct = first > 0 ? Math.max((step.value / first) * 100, step.value > 0 ? 4 : 0) : 0;
        return (
          <div
            key={step.label}
            className="relative rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 transition-colors hover:border-zinc-200 hover:bg-zinc-50"
            tabIndex={0}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600">
                {i + 1}
              </span>
              {step.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">
              {fmt(step.value)}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200/70">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${barPct}%`, background: CHART_COLORS[0] }}
              />
            </div>
            <p className="mt-2 text-xs tabular-nums text-zinc-500">
              {i === 0
                ? "100% — everyone starts here"
                : prev > 0
                  ? `${stepPct.toFixed(1)}% of previous step`
                  : step.value > 0
                    ? `${overallPct.toFixed(1)}% of all visitors`
                    : "no one reached this step yet"}
            </p>
            {hover === i && i > 0 ? (
              <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-full pb-1.5">
                <TooltipCard
                  title={step.label}
                  rows={[
                    { color: CHART_COLORS[0], label: "people", value: fmt(step.value) },
                    { label: "of previous step", value: `${stepPct.toFixed(1)}%` },
                    { label: "of all visitors", value: `${overallPct.toFixed(1)}%` },
                    { label: "dropped off", value: fmt(Math.max(prev - step.value, 0)) },
                  ]}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ── KPI tile with period-over-period delta ───────────────────────────────────

export function DeltaKpi({
  label,
  value,
  prev,
  current,
  hint,
  downIsGood = false,
}: {
  label: string;
  value: React.ReactNode;
  /** Raw numbers for the delta; omit prev (or pass 0-vs-0) to hide the badge. */
  current?: number;
  prev?: number;
  hint?: string;
  downIsGood?: boolean;
}) {
  let badge: React.ReactNode = null;
  if (current !== undefined && prev !== undefined && (current !== 0 || prev !== 0)) {
    if (prev === 0) {
      badge = <span className="text-xs font-medium text-zinc-400">new</span>;
    } else {
      const pct = ((current - prev) / prev) * 100;
      const up = pct >= 0;
      const good = downIsGood ? !up : up;
      badge = (
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ${
            good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
          title="vs previous period"
        >
          {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
        </span>
      );
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</p>
        {badge}
      </div>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
