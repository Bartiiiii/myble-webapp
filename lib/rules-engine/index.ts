// Public API of the Myble Rules Engine (future @myble/rules-engine package).
// Import from "@/lib/rules-engine" — internals are not part of the contract.

export { createEngine, RulesEngine, STAGE_ORDER, type EngineOptions, type ValidateOptions } from "./engine";
export { loadCatalogue, unvalidatedSafetyRules, CatalogueError } from "./loader";
export { sanitizeDesign, DesignInputError, INPUT_LIMITS } from "./design";
export type {
  DesignModel, DesignUnit, Part, PartRole, PartEdge, Hole, Shelf, Door, Drawer,
  Joint, JointType, Divider, Brace, BackMethod, ShelfLoadClass, ShelfFixity,
} from "./design";
export type { Rule, RuleCategory, RulesCatalogue, Material, Hardware, Severity, ProductCategory } from "./types";
export {
  HEALTH_PRECEDENCE,
  toAuditRecords,
  type ValidationFinding, type ValidationReport, type Verdict, type DesignHealthStatus, type AuditRecord,
} from "./report";
export type { EvalStage, OrderContext } from "./context";
export { renderMessage, messageHash, type Locale } from "./messages";
export {
  findingRequiresAcknowledgement, isAcknowledged, makeAcknowledgement, type Acknowledgement,
} from "./acknowledgements";
export { getValidRange, type RangeTarget, type ValidRange } from "./constraints";
export { proposeFixes, type DesignPatch } from "./fixes";
export { UNVALIDATED_PARTNER_PROFILE, DEFAULT_CARRIER_PROFILES, type PartnerProfile, type CarrierProfile } from "./profiles";
export { ENGINE_VERSION, CREEP_FACTOR } from "./constants";
export { canonicalJson, hashOf } from "./canonical";
export { shelfDeflection, sagLimitMm, enforcedSagLimitMm } from "./calc/deflection";
export { tippingMargin } from "./calc/tipping";
export { unitMassKg, partMassKg, doorMassKg } from "./calc/mass";
export { packDesign, carrierFor } from "./calc/packaging";
