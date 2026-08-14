// Partner & carrier profiles. Partner-specific values live here, not in rules
// (schema §2 partner_dependency). Fields that are `null` are UNKNOWN — rules
// depending on them fail closed until the partner confirms the capability.

import type { BackMethod } from "./design";

export interface PartnerProfile {
  partner_id: string;
  capabilities: {
    /** Can the edging partner apply 2 mm ABS (premill recommended)? */
    edging_2mm: boolean | null;
    premill: boolean | null;
    /** Back-panel methods the partner supports; one is frozen per profile. */
    back_methods: BackMethod[] | null;
  };
  tolerances: {
    cut_mm: number;
    drill_mm: number;
  } | null;
}

/** All-unknown default: forces fail-closed behaviour until partners confirm. */
export const UNVALIDATED_PARTNER_PROFILE: PartnerProfile = {
  partner_id: "unvalidated",
  capabilities: { edging_2mm: null, premill: null, back_methods: null },
  tolerances: null,
};

export interface CarrierProfile {
  carrier_id: string;
  /** Longest single side, mm. */
  max_side_mm: number;
  /** Girth = 2×H + 2×W + L, mm; null = carrier has no girth rule. */
  max_girth_mm: number | null;
  max_mass_kg: number;
  /** Per-dimension box cap [L,W,H] mm; null = only side/girth rules. */
  max_dims_mm: [number, number, number] | null;
  /** Date the limits were last verified with the carrier; null = unverified. */
  verified: string | null;
  provisional: boolean;
}

/**
 * From SHIP-PANEL-001 (values requiring validation with logistics partner;
 * carrier terms change — re-verify quarterly). Order = engine preference:
 * first feasible profile wins (deterministic; pricing integration later).
 */
export const DEFAULT_CARRIER_PROFILES: CarrierProfile[] = [
  {
    carrier_id: "gls_cz",
    max_side_mm: 2000,
    max_girth_mm: 3000,
    max_mass_kg: 40,
    max_dims_mm: null,
    verified: null,
    provisional: true,
  },
  {
    carrier_id: "ppl_cz_private",
    max_side_mm: 1000,
    max_girth_mm: null,
    max_mass_kg: 31.5,
    max_dims_mm: [1000, 500, 500],
    verified: null,
    provisional: true,
  },
  {
    carrier_id: "dpd_cz",
    max_side_mm: 1000,
    max_girth_mm: null,
    max_mass_kg: 31.5,
    max_dims_mm: null,
    verified: null,
    provisional: true,
  },
];
