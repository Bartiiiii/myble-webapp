// Tipping-moment screening (implementation task 4 / tipping.ts, STAB-CALC-003).
//
// Static moment balance about the FRONT TOE LINE, worst case: all doors open
// 90°, all drawers fully extended. Conservative bounds both directions:
// stabilising carcass mass uses the LOWER density bound; overturning door and
// drawer masses use the UPPER bound.
//
// Loaded-margin check: `margin_min_loaded` is null in the catalogue
// (requires_test) — per fail-closed policy the loaded check cannot pass and
// returns "blocked_unvalidated", which maps to anchor-required/review.

import type { DesignModel } from "../design";
import type { Material, Rule } from "../types";
import { unitMassKg, materialDensity, MassError } from "./mass";
import { GRAVITY_M_S2 } from "../units";

export interface TippingResult {
  /** Stabilising moment about the front toe line, N·mm. */
  m_stab_Nmm: number;
  /** Worst-case overturning moment (doors open, drawers out), N·mm. */
  m_tip_Nmm: number;
  /** m_stab / m_tip; Infinity when nothing can overturn the unit. */
  margin_unloaded: number;
  /** Always "blocked_unvalidated" until margin_min_loaded is validated. */
  loaded_check: "blocked_unvalidated" | "ok" | "violated";
  carcass_mass_lower_kg: number;
}

export function tippingMargin(
  design: DesignModel,
  materials: Map<string, Material>,
  rule: Rule,
): TippingResult {
  const g = GRAVITY_M_S2;
  const depth = design.unit.depth_mm;

  const doorPartIds = new Set(design.doors.map((d) => d.part_id));
  const massLower = unitMassKg(design, materials, "lower");
  const massUpper = unitMassKg(design, materials, "upper");

  // Stabilising: carcass (everything except doors) with COG at depth/2 behind
  // the front toe line, using the LOWER mass bound. Drawer boxes are modelled
  // in their extended (overturning) position, so they don't stabilise either.
  let carcassKg = 0;
  for (const [partId, m] of massLower.by_part) {
    if (!doorPartIds.has(partId)) carcassKg += m;
  }
  const mStab = carcassKg * g * (depth / 2);

  // Overturning: door open 90° puts its COG width/2 in front of the front face
  // (hinged on a side edge); UPPER mass bound.
  let mTip = 0;
  for (const door of design.doors) {
    const doorMass = massUpper.by_part.get(door.part_id);
    if (doorMass === undefined) throw new MassError(`door part ${door.part_id} not found in mass table`);
    mTip += doorMass * g * (door.width_mm / 2);
  }
  // Drawer fully extended: box COG ≈ travel/2 in front of the front face.
  // Travel = drawer depth (full extension screening assumption, conservative).
  for (const drawer of design.drawers) {
    const boxKg = drawerBoxMassUpperKg(drawer.width_mm, drawer.depth_mm, drawer.height_mm, materials);
    mTip += boxKg * g * (drawer.depth_mm / 2);
  }

  const margin = mTip === 0 ? Infinity : mStab / mTip;

  // Loaded check is gated on the catalogue threshold, never a code default.
  const t = rule.threshold;
  const marginMinLoaded =
    t !== null && typeof t === "object" && typeof t["margin_min_loaded"] === "number"
      ? (t["margin_min_loaded"] as number)
      : null;

  return {
    m_stab_Nmm: mStab,
    m_tip_Nmm: mTip,
    margin_unloaded: margin,
    loaded_check: marginMinLoaded === null ? "blocked_unvalidated" : margin >= marginMinLoaded ? "ok" : "violated",
    carcass_mass_lower_kg: carcassKg,
  };
}

/**
 * Simplified drawer box mass: 4 sides in 18 mm board + 3 mm bottom, all at the
 * board's UPPER density bound (HDF density is unvalidated; board density is an
 * overestimate for the thin bottom — conservative for overturning).
 */
function drawerBoxMassUpperKg(
  width_mm: number,
  depth_mm: number,
  height_mm: number,
  materials: Map<string, Material>,
): number {
  const board = materials.get("ltd_18_p2");
  if (!board) throw new MassError("ltd_18_p2 material required for drawer mass");
  const density = materialDensity(board, "upper");
  const t = 0.018;
  const w = width_mm / 1000;
  const d = depth_mm / 1000;
  const h = height_mm / 1000;
  const sidesM3 = 2 * (d * h * t) + 2 * (w * h * t);
  const bottomM3 = w * d * 0.003;
  return (sidesM3 + bottomM3) * density;
}
