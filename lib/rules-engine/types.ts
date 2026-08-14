// ─────────────────────────────────────────────────────────────────────────────
// Catalogue types — mirrors Myble_Rules_Schema_v1.md §1–§4. These describe the
// JSON catalogue; the engine never invents values that are null here (§7:
// null threshold on a requires_validation safety rule can never PASS).
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 0 | 1 | 2 | 3 | 4 | 5;

export type RuleCategory =
  | "product_scope"
  | "material"
  | "structural"
  | "stability"
  | "connection"
  | "frameless_system"
  | "manufacturing"
  | "assembly"
  | "shipping"
  | "ux";

export type ProductCategory =
  | "shelving_unit"
  | "bookcase"
  | "cabinet"
  | "bedside_table"
  | "storage_unit"
  | "desk_simple"
  | "all";

export type Confidence = "high" | "medium" | "low";
export type ValidationStatus = "validated" | "requires_validation" | "requires_test";

export interface RuleSource {
  ref: string;
  detail?: string;
  tier: number; // 1 = law/standard … 7 = general commentary
}

export type Threshold = number | Record<string, number | string | null> | null;

export interface Rule {
  rule_id: string;
  name: string;
  product_categories: ProductCategory[];
  rule_category: RuleCategory;
  description: string;
  rationale: string;
  sources: RuleSource[];
  inputs: string[];
  /** Pseudocode documentation only — never evaluated (§11: no dynamic eval). */
  condition?: string;
  threshold: Threshold;
  threshold_units?: string;
  provisional: boolean;
  material_dependency?: string[];
  hardware_dependency?: string[];
  partner_dependency?: string | null;
  severity: Severity;
  backend: boolean;
  user_message?: { en: string; cs?: string | null } | null;
  suggested_fix?: string | null;
  auto_correct: boolean;
  manual_review: boolean;
  confidence: Confidence;
  validation_status: ValidationStatus;
  validation_owner?: string;
  test_method?: string;
  notes?: string;
}

export interface MaterialValueMaybe {
  value: number | null;
  provisional_range?: [number, number];
  [k: string]: unknown;
}

export interface Material {
  material_id: string;
  names: Record<string, string>;
  standard?: string;
  nominal_thickness_mm: number;
  sheet_format_mm?: [number, number];
  bending_strength_Nmm2?: { value: number; [k: string]: unknown };
  moe_bending_Nmm2?: { value: number; [k: string]: unknown };
  internal_bond_Nmm2?: { value: number; [k: string]: unknown };
  density_kg_m3?: MaterialValueMaybe;
  area_mass_18mm_kg_m2?: MaterialValueMaybe;
  status?: string;
  [k: string]: unknown;
}

export interface Hardware {
  hardware_id: string;
  name: string;
  drilling?: Record<string, unknown>;
  min_panel_thickness_mm?: number;
  rated_load_N?: number | null;
  rated_load_per_pin_kg?: { value: number; [k: string]: unknown };
  rated_dynamic_load_kg?: number;
  count_rule?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface LoadPresets {
  shelf_uniform_design_load_kg_dm2: { value: number; [k: string]: unknown };
  shelf_load_classes: Record<string, { kg_m2: number; provisional?: boolean; [k: string]: unknown }>;
  deflection_limit: { value: string; provisional?: boolean; [k: string]: unknown };
}

export interface RulesCatalogue {
  catalogue_version: string;
  generated: string;
  status?: string;
  units: string;
  source_tiers?: Record<string, string>;
  severity_levels: Record<string, string>;
  materials: Material[];
  hardware: Hardware[];
  load_presets: LoadPresets;
  rules: Rule[];
}
