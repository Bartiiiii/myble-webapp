// ─────────────────────────────────────────────────────────────────────────────
// Named engineering constants. Values marked PROVISIONAL are conservative
// placeholders from the catalogue/implementation prompt, NOT validated limits —
// they must be confirmed by Myble's validation process (engineer, partners,
// lab tests) before launch. A `null` here means "unknown": dependent checks
// must fail closed (REQUIRES_VALIDATION_BLOCKED), never pass silently.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Long-term creep multiplier for particleboard under sustained load.
 * TODO(validation): particleboard creeps 1.5–2× elastic deflection (tier 5);
 * value must come from physical EN 16122-style tests. While null, deflection
 * limits are applied at CREEP_UNVALIDATED_LIMIT_FACTOR (conservative mode).
 */
export const CREEP_FACTOR: number | null = null;

/**
 * PROVISIONAL — while CREEP_FACTOR is null, the sag limit is applied at 60 %.
 * The 0.6 factor itself is a placeholder pending validation.
 */
export const CREEP_UNVALIDATED_LIMIT_FACTOR = 0.6;

/**
 * Minimum width of open-back bracing rails (STRUCT-BACK-004). The catalogue
 * threshold is null (requires_test); 100 mm is the tier-6 placeholder used ONLY
 * to size auto-proposed rails. Validation of rail width cannot PASS while this
 * is unvalidated — open-back designs route to review (schema §7).
 */
export const OPEN_BACK_RAIL_PLACEHOLDER_WIDTH_MM = 100;

/**
 * PROVISIONAL connector counts per joint end (CONN-SYS-001, tier 5/6):
 * 2 cams + 2 dowels per end; panels ≥ 600 mm deep use 3 cams + 2 dowels.
 */
export const CAMS_PER_JOINT_END = 2;
export const DOWELS_PER_JOINT_END = 2;
export const DEEP_PANEL_CAM_COUNT = 3;
export const DEEP_PANEL_DEPTH_MM = 600;

/**
 * Drawer content density presets, kg per litre of internal drawer volume.
 * PROVISIONAL tier-6 assumptions for CONN-RUNNER-006 screening; validate with
 * ops data. Kept deliberately conservative (paper is the heavy case).
 */
export const DRAWER_LOAD_PRESET_KG_PER_L: Record<string, number> = {
  utensils: 0.15,
  clothes: 0.12,
  paper: 0.35,
};

/** Engine semver — bump on any behaviour change (audit records embed it). */
export const ENGINE_VERSION = "1.0.0";
