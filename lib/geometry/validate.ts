// Design validation — sizes, the sacred 120 cm parcel rule, part count and the
// no-floating connectivity check. Returns locale-agnostic issue CODES; the UI
// translates them (see lib/i18n). Geometry stays language-free.
import { type Design, LIMITS, MAX_EDGE_CM, MAX_PARTS } from "../model";
import { connectivity } from "./contact";

export type IssueCode = "min" | "max" | "nan" | "tooMany" | "maxEdge" | "floating";
export type DimField = "width" | "height" | "depth";

export interface Issue {
  code: IssueCode;
  field?: DimField;
  value?: number;
}

export interface Validation {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  /** Ids of detached parts (amber-highlighted; they block Order, not editing). */
  floatingIds: string[];
}

export function validate(design: Design): Validation {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const { w, h, d } = design.outerCm;

  const checkRange = (field: DimField, v: number, lo: number, hi: number) => {
    if (Number.isNaN(v)) errors.push({ code: "nan", field });
    else if (v < lo) errors.push({ code: "min", field, value: lo });
    else if (v > hi) errors.push({ code: "max", field, value: hi });
  };

  checkRange("width", w, LIMITS.w.min, LIMITS.w.max);
  checkRange("height", h, LIMITS.h.min, LIMITS.h.max);
  checkRange("depth", d, LIMITS.d.min, LIMITS.d.max);

  if (design.parts.length > MAX_PARTS) {
    errors.push({ code: "tooMany", value: MAX_PARTS });
  }

  // The 120 cm max-edge parcel rule (verified shipping constraint) — kept as a
  // gentle warning, exactly as before.
  if (w > MAX_EDGE_CM || h > MAX_EDGE_CM) {
    warnings.push({ code: "maxEdge", value: MAX_EDGE_CM });
  }

  // No-floating: every part must connect into one piece.
  const conn = connectivity(design);
  if (!conn.connected) {
    errors.push({ code: "floating" });
  }

  return { ok: errors.length === 0, errors, warnings, floatingIds: conn.floatingIds };
}
