// Hole pattern feasibility: min 8 mm web between adjacent bore walls, Ø35
// cups only in ≥16 mm panels, no through-bores on visible faces.

import type { Evaluator, RawFinding } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const minWeb = thresholdNum(ctx.rule, "min_web_mm");
  const cupMinThickness = thresholdNum(ctx.rule, "cup_min_thickness_mm");
  const findings: RawFinding[] = [];

  for (const part of design.parts) {
    const problems: string[] = [];
    for (let i = 0; i < part.holes.length; i++) {
      const a = part.holes[i];
      if (a.dia_mm >= 35 && part.thickness_mm < cupMinThickness) problems.push("cup_in_thin_panel");
      if (a.through && part.visibility === "visible") problems.push("through_bore_on_visible_part");
      for (let j = i + 1; j < part.holes.length; j++) {
        const b = part.holes[j];
        const centreDist = Math.hypot(a.x_mm - b.x_mm, a.y_mm - b.y_mm);
        const web = centreDist - a.dia_mm / 2 - b.dia_mm / 2;
        if (web < 0) problems.push("overlapping_bores");
        else if (web < minWeb) problems.push("insufficient_web");
      }
    }
    if (problems.length > 0) {
      findings.push(violated({ part_ids: [part.id], computed: { problems: [...new Set(problems)].join(",") } }));
    }
  }
  if (findings.length === 0) return [ok({ parts_checked: design.parts.length })];
  return findings;
};
