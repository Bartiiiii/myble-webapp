// Shelf deflection (implementation task 4 / deflection.ts).
//
//   δ = 5·w·L⁴ / (384·E·I),  I = b·t³ / 12
//
// Simply-supported uniform load — the standard model for adjustable shelves
// (fixed shelves are stiffer, so this is conservative for them too).
// E defaults to 1600 N/mm² (EN 312 P2 minimum) until a supplier value is
// validated. Elastic only: NO creep factor yet — while CREEP_FACTOR is null
// the limit is applied at CREEP_UNVALIDATED_LIMIT_FACTOR (0.6, itself
// provisional). Loads come from the catalogue presets (0.65 kg/dm² default,
// EN 16122); self-weight is NOT included (matches the EN-style design load).

import { CREEP_FACTOR, CREEP_UNVALIDATED_LIMIT_FACTOR } from "../constants";
import { GRAVITY_M_S2 } from "../units";

export interface DeflectionInput {
  span_mm: number;
  depth_mm: number;
  thickness_mm: number;
  /** Modulus of elasticity, N/mm². */
  moe_Nmm2: number;
  /** Uniform design load on the shelf face, kg/m². */
  load_kg_m2: number;
}

export interface DeflectionResult {
  delta_mm: number;
  /** Line load along the span, N/mm. */
  w_N_per_mm: number;
  /** Second moment of area, mm⁴. */
  I_mm4: number;
}

export function shelfDeflection(input: DeflectionInput): DeflectionResult {
  const { span_mm: L, depth_mm: b, thickness_mm: t, moe_Nmm2: E, load_kg_m2 } = input;
  if (L <= 0 || b <= 0 || t <= 0 || E <= 0 || load_kg_m2 < 0) {
    throw new Error("shelfDeflection: dimensions and E must be positive");
  }
  const I = (b * t ** 3) / 12;
  // Total load on the shelf face, converted to N, spread along the span.
  const areaM2 = (L / 1000) * (b / 1000);
  const totalN = load_kg_m2 * areaM2 * GRAVITY_M_S2;
  const w = totalN / L; // N/mm
  const delta = (5 * w * L ** 4) / (384 * E * I);
  return { delta_mm: delta, w_N_per_mm: w, I_mm4: I };
}

/** Catalogue sag limit: 1.7 mm per 300 mm of span, never more than span/200. */
export function sagLimitMm(span_mm: number): number {
  return Math.min((1.7 * span_mm) / 300, span_mm / 200);
}

/**
 * The limit actually enforced. While the particleboard creep factor is
 * unvalidated (CREEP_FACTOR === null) the engine runs in conservative mode:
 * elastic deflection must stay under 60 % of the sag limit.
 */
export function enforcedSagLimitMm(span_mm: number): { limit_mm: number; conservative_mode: boolean } {
  const base = sagLimitMm(span_mm);
  if (CREEP_FACTOR === null) {
    return { limit_mm: base * CREEP_UNVALIDATED_LIMIT_FACTOR, conservative_mode: true };
  }
  return { limit_mm: base / CREEP_FACTOR, conservative_mode: false };
}
