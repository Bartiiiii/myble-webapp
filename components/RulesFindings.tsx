"use client";

// Sales-first findings panel for the configurator. Shows a status chip plus the
// engine's expert recommendations grouped by severity. Nothing here ever hides
// or disables the Order button: the engine advises, it never stops a sale.
// Severity-4 findings are the strongest advice we give (we'll review the design
// with the customer before production), so they read as review, not rejection.

import React from "react";
import { useT, type TFn } from "../lib/i18n";
import type { UiFinding, UiReport } from "../lib/rules-engine/configurator";
import type { DesignHealthStatus } from "../lib/rules-engine/report";

type Tone = "good" | "info" | "amber" | "review" | "block";

const HEALTH_TONE: Record<DesignHealthStatus, Tone> = {
  VALID: "good",
  VALID_WITH_RECOMMENDATIONS: "info",
  REQUIRES_CONFIRMATION: "amber",
  REQUIRES_WALL_ANCHOR: "amber",
  REQUIRES_REVIEW: "review",
  // Sales-first: even the gravest health never reads as a wall. We take the
  // order and confirm the design with the customer before production.
  CANNOT_MANUFACTURE: "review",
  UNSAFE: "review",
};

const TONE_CLASS: Record<Tone, string> = {
  good: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  info: "bg-sky-50 text-sky-700 ring-sky-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  review: "bg-violet-50 text-violet-700 ring-violet-100",
  block: "bg-rose-50 text-rose-700 ring-rose-100",
};

const DOT_CLASS: Record<Tone, string> = {
  good: "bg-emerald-500",
  info: "bg-sky-500",
  amber: "bg-amber-500",
  review: "bg-violet-500",
  block: "bg-rose-500",
};

function severityLabel(t: TFn, severity: number): string {
  if (severity >= 4) return t("rules.severityReview");
  if (severity === 3) return t("rules.severityConfirm");
  if (severity === 2) return t("rules.severityRec");
  return t("rules.severityTip");
}

function chipText(t: TFn, health: DesignHealthStatus): { title: string; hint: string } {
  switch (health) {
    case "VALID":
      return { title: t("rules.allGood"), hint: "" };
    case "VALID_WITH_RECOMMENDATIONS":
    case "REQUIRES_CONFIRMATION":
      return { title: t("rules.recommendations"), hint: t("rules.recommendationsHint") };
    case "REQUIRES_WALL_ANCHOR":
      return { title: t("rules.anchorTitle"), hint: t("rules.anchorHint") };
    case "REQUIRES_REVIEW":
      return { title: t("rules.reviewTitle"), hint: t("rules.reviewHint") };
    case "CANNOT_MANUFACTURE":
    case "UNSAFE":
      return { title: t("rules.reviewTitle"), hint: t("rules.reviewHint") };
  }
}

export interface RulesFindingsProps {
  report: UiReport | null;
  validating?: boolean;
  /** Called when the user hovers/focuses a finding, to highlight its parts. */
  onHighlight?: (partIds: string[]) => void;
}

export function RulesFindings({ report, validating, onHighlight }: RulesFindingsProps) {
  const t = useT();
  if (!report) return null;

  const health = report.report.health;
  const tone = HEALTH_TONE[health];
  const { title, hint } = chipText(t, health);

  // Blocking findings first, then confirmations, then softer tips.
  const blocking = report.findings.filter((f) => f.severity >= 4 && f.verdict !== "OK");
  const confirmations = report.findings.filter((f) => f.severity === 3 && f.verdict === "VIOLATED");
  const tips = report.findings.filter((f) => f.severity > 0 && f.severity <= 2 && f.verdict === "VIOLATED");

  const showList = blocking.length > 0 || confirmations.length > 0 || tips.length > 0;

  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-zinc-200 shadow-sm" aria-live="polite">
      <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ${TONE_CLASS[tone]}`}>
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[tone]} ${validating ? "animate-pulse" : ""}`} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{validating ? t("rules.checking") : title}</p>
          {hint && !validating && <p className="mt-0.5 text-xs opacity-90">{hint}</p>}
        </div>
      </div>

      {showList && (
        <ul className="mt-4 space-y-3">
          {[...blocking, ...confirmations, ...tips].map((f, i) => (
            <FindingRow key={`${f.rule_id}:${f.part_ids.join(",")}:${i}`} finding={f} t={t} onHighlight={onHighlight} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FindingRow({
  finding,
  t,
  onHighlight,
}: {
  finding: UiFinding;
  t: TFn;
  onHighlight?: (partIds: string[]) => void;
}) {
  const blocking = finding.severity >= 4;
  const accent = blocking
    ? "border-violet-200 bg-violet-50/40"
    : finding.severity === 3
      ? "border-amber-200 bg-amber-50/40"
      : "border-zinc-200 bg-zinc-50/60";

  return (
    <li
      className={`rounded-2xl border p-3 ${accent}`}
      onMouseEnter={() => onHighlight?.(finding.part_ids)}
      onMouseLeave={() => onHighlight?.([])}
      onFocus={() => onHighlight?.(finding.part_ids)}
      onBlur={() => onHighlight?.([])}
      tabIndex={0}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-semibold uppercase tracking-wide ${
            blocking ? "text-violet-700" : finding.severity === 3 ? "text-amber-700" : "text-zinc-500"
          }`}
        >
          {severityLabel(t, finding.severity)}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-800">{finding.message ?? finding.rule_name}</p>
      {finding.suggested_fix && (
        <p className="mt-1.5 text-xs text-zinc-500">
          <span className="font-medium text-zinc-600">{t("rules.fixLabel")}:</span> {finding.suggested_fix}
        </p>
      )}
    </li>
  );
}
