// Complexity caps: ≤ 60 parts, ≤ 25 unique geometries, ≤ 12 drilling
// patterns; beyond caps → manual review for quotability (severity 5).

import type { Evaluator } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const maxParts = thresholdNum(ctx.rule, "max_parts");
  const maxUnique = thresholdNum(ctx.rule, "max_unique");
  const maxPatterns = thresholdNum(ctx.rule, "max_patterns");

  const geometries = new Set(
    design.parts.map((p) => `${p.length_mm}x${p.width_mm}x${p.thickness_mm}:${p.material_id}`),
  );
  const patterns = new Set(
    design.parts.map((p) =>
      p.holes
        .map((h) => `${h.x_mm},${h.y_mm},${h.dia_mm},${h.depth_mm},${h.through ? 1 : 0}`)
        .sort()
        .join(";"),
    ),
  );

  const computed = {
    parts: design.parts.length,
    unique_geometries: geometries.size,
    drilling_patterns: patterns.size,
  };
  if (design.parts.length > maxParts || geometries.size > maxUnique || patterns.size > maxPatterns) {
    return [violated({ computed })];
  }
  return [ok(computed)];
};
