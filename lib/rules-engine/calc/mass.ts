// Mass estimation (implementation task 4 / mass.ts).
// Part mass = area × thickness × density. Board density is a PROVISIONAL RANGE
// until the supplier datasheet is validated, so every consumer must pick a
// bound explicitly: UPPER for shipping/overturning masses, LOWER for
// stabilising masses — conservative in both directions.

import type { DesignModel, Part } from "../design";
import type { Material } from "../types";

export type DensityBound = "upper" | "lower";

export class MassError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "MassError";
  }
}

export function materialDensity(material: Material, bound: DensityBound): number {
  const d = material.density_kg_m3;
  if (d?.value != null) return d.value;
  const range = d?.provisional_range;
  if (!range) throw new MassError(`material ${material.material_id} has no density data`);
  return bound === "upper" ? range[1] : range[0];
}

export function partMassKg(part: Part, material: Material, bound: DensityBound): number {
  const volumeM3 = (part.length_mm / 1000) * (part.width_mm / 1000) * (part.thickness_mm / 1000);
  return volumeM3 * materialDensity(material, bound);
}

/** kg/m² of a panel face at the part's thickness. */
export function areaMassKgM2(part: Part, material: Material, bound: DensityBound): number {
  return (part.thickness_mm / 1000) * materialDensity(material, bound);
}

export interface UnitMass {
  total_kg: number;
  by_part: Map<string, number>;
}

export function unitMassKg(
  design: DesignModel,
  materials: Map<string, Material>,
  bound: DensityBound,
): UnitMass {
  const by_part = new Map<string, number>();
  let total = 0;
  for (const part of design.parts) {
    const material = materials.get(part.material_id);
    if (!material) throw new MassError(`unknown material ${part.material_id} on part ${part.id}`);
    const m = partMassKg(part, material, bound);
    by_part.set(part.id, m);
    total += m;
  }
  return { total_kg: total, by_part };
}

/**
 * Door mass for hinge-count checks (CONN-HINGE-004): area × board area-mass.
 * Uses the UPPER density bound (heavier door ⇒ more hinges ⇒ conservative).
 * NOTE: the catalogue mentions a "handle allowance" with no value — no value is
 * invented here; the allowance is a validation-owner TODO tracked in the rule.
 */
export function doorMassKg(width_mm: number, height_mm: number, thickness_mm: number, material: Material): number {
  const areaM2 = (width_mm / 1000) * (height_mm / 1000);
  return areaM2 * (thickness_mm / 1000) * materialDensity(material, "upper");
}
