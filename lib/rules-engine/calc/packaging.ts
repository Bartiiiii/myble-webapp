// Deterministic panel bin-packing (implementation task 4 / packaging.ts).
//
// Flat-pack packs are panel stacks: pack footprint = largest panel in the pack
// plus a protective allowance per side (SHIP-PROT-003, provisional 20 mm);
// pack height = Σ panel thicknesses + allowance. Greedy fill in a STABLE order
// (sort by longest side desc, then shortest side desc, then part id) — no
// randomised heuristics, same input ⇒ same packs, always.

import type { DesignModel, Part } from "../design";
import type { Material } from "../types";
import type { CarrierProfile } from "../profiles";
import { partMassKg, MassError } from "./mass";

/** SHIP-PROT-003 packaging allowance per side, mm. PROVISIONAL. */
export const PACKAGING_ALLOWANCE_MM = 20;
/** SHIP-MASS-002 handling target / hard cap, kg. PROVISIONAL. */
export const PACK_TARGET_KG = 25;
export const PACK_HARD_KG = 30;

export interface PackedPackage {
  index: number;
  part_ids: string[];
  /** Outer dims incl. allowance, mm, [L ≥ W ≥ H]. */
  dims_mm: [number, number, number];
  mass_kg: number;
  /** First feasible carrier, or "pallet_freight" when no parcel carrier fits. */
  carrier: string;
}

export interface PackagingResult {
  packages: PackedPackage[];
  total_mass_kg: number;
  any_pallet: boolean;
}

function girth(dims: [number, number, number]): number {
  const [l, w, h] = dims;
  return l + 2 * w + 2 * h;
}

export function carrierFor(dims: [number, number, number], mass_kg: number, carriers: CarrierProfile[]): string {
  for (const c of carriers) {
    if (dims[0] > c.max_side_mm) continue;
    if (c.max_girth_mm !== null && girth(dims) > c.max_girth_mm) continue;
    if (mass_kg > c.max_mass_kg) continue;
    if (c.max_dims_mm !== null) {
      const cap = [...c.max_dims_mm].sort((a, b) => b - a);
      if (dims[0] > cap[0] || dims[1] > cap[1] || dims[2] > cap[2]) continue;
    }
    return c.carrier_id;
  }
  return "pallet_freight";
}

export function packDesign(
  design: DesignModel,
  materials: Map<string, Material>,
  carriers: CarrierProfile[],
): PackagingResult {
  interface P {
    part: Part;
    long: number;
    short: number;
    mass: number;
  }
  const items: P[] = design.parts.map((part) => {
    const material = materials.get(part.material_id);
    if (!material) throw new MassError(`unknown material ${part.material_id} on part ${part.id}`);
    return {
      part,
      long: Math.max(part.length_mm, part.width_mm),
      short: Math.min(part.length_mm, part.width_mm),
      mass: partMassKg(part, material, "upper"), // shipping mass: upper bound
    };
  });
  // Stable deterministic order.
  items.sort((a, b) => b.long - a.long || b.short - a.short || a.part.id.localeCompare(b.part.id));

  const packages: PackedPackage[] = [];
  let current: P[] = [];

  const flush = (): void => {
    if (current.length === 0) return;
    const long = Math.max(...current.map((p) => p.long)) + 2 * PACKAGING_ALLOWANCE_MM;
    const short = Math.max(...current.map((p) => p.short)) + 2 * PACKAGING_ALLOWANCE_MM;
    const height = current.reduce((s, p) => s + p.part.thickness_mm, 0) + 2 * PACKAGING_ALLOWANCE_MM;
    const dims = [long, short, height].sort((a, b) => b - a) as [number, number, number];
    const mass = current.reduce((s, p) => s + p.mass, 0);
    packages.push({
      index: packages.length,
      part_ids: current.map((p) => p.part.id),
      dims_mm: dims,
      mass_kg: mass,
      carrier: carrierFor(dims, mass, carriers),
    });
    current = [];
  };

  for (const item of items) {
    const mass = current.reduce((s, p) => s + p.mass, 0);
    if (current.length > 0 && mass + item.mass > PACK_TARGET_KG) flush();
    current.push(item);
    // A single part heavier than the target still ships alone (may exceed
    // target; SHIP-MASS-002 flags it if it busts the hard cap).
    if (item.mass > PACK_TARGET_KG) flush();
  }
  flush();

  return {
    packages,
    total_mass_kg: packages.reduce((s, p) => s + p.mass_kg, 0),
    any_pallet: packages.some((p) => p.carrier === "pallet_freight"),
  };
}
