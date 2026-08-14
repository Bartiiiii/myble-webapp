// Evaluator registry: 1:1 with the catalogue (enforced by conformance tests).
// File names match rule ids so audits jump straight from finding to code.

import type { Evaluator } from "../context";

import { evaluate as SCOPE_CAT_001 } from "./SCOPE-CAT-001";
import { evaluate as SCOPE_CAT_002 } from "./SCOPE-CAT-002";
import { evaluate as SCOPE_SIZE_003 } from "./SCOPE-SIZE-003";
import { evaluate as SCOPE_REV_004 } from "./SCOPE-REV-004";
import { evaluate as MAT_THK_001 } from "./MAT-THK-001";
import { evaluate as MAT_SIZE_002 } from "./MAT-SIZE-002";
import { evaluate as MAT_EDGE_003 } from "./MAT-EDGE-003";
import { evaluate as MAT_EDGE_004 } from "./MAT-EDGE-004";
import { evaluate as MAT_DECOR_005 } from "./MAT-DECOR-005";
import { evaluate as MAT_MOIST_006 } from "./MAT-MOIST-006";
import { evaluate as STRUCT_SHELF_001 } from "./STRUCT-SHELF-001";
import { evaluate as STRUCT_SHELF_002 } from "./STRUCT-SHELF-002";
import { evaluate as STRUCT_BACK_003 } from "./STRUCT-BACK-003";
import { evaluate as STRUCT_BACK_004 } from "./STRUCT-BACK-004";
import { evaluate as STRUCT_DIV_005 } from "./STRUCT-DIV-005";
import { evaluate as STRUCT_FIX_006 } from "./STRUCT-FIX-006";
import { evaluate as STRUCT_TOP_007 } from "./STRUCT-TOP-007";
import { evaluate as STRUCT_DESK_008 } from "./STRUCT-DESK-008";
import { evaluate as STRUCT_GEOM_009 } from "./STRUCT-GEOM-009";
import { evaluate as STAB_TRIG_001 } from "./STAB-TRIG-001";
import { evaluate as STAB_ANCHOR_002 } from "./STAB-ANCHOR-002";
import { evaluate as STAB_CALC_003 } from "./STAB-CALC-003";
import { evaluate as STAB_DRAWER_004 } from "./STAB-DRAWER-004";
import { evaluate as STAB_SHELF_005 } from "./STAB-SHELF-005";
import { evaluate as CONN_SYS_001 } from "./CONN-SYS-001";
import { evaluate as CONN_EDGE_002 } from "./CONN-EDGE-002";
import { evaluate as CONN_SPACING_003 } from "./CONN-SPACING-003";
import { evaluate as CONN_HINGE_004 } from "./CONN-HINGE-004";
import { evaluate as CONN_PIN_005 } from "./CONN-PIN-005";
import { evaluate as CONN_RUNNER_006 } from "./CONN-RUNNER-006";
import { evaluate as CONN_REUSE_007 } from "./CONN-REUSE-007";
import { evaluate as SYS32_GRID_001 } from "./SYS32-GRID-001";
import { evaluate as SYS32_SNAP_002 } from "./SYS32-SNAP-002";
import { evaluate as SYS32_GAP_003 } from "./SYS32-GAP-003";
import { evaluate as SYS32_BACK_004 } from "./SYS32-BACK-004";
import { evaluate as SYS32_PLINTH_005 } from "./SYS32-PLINTH-005";
import { evaluate as MFG_MIN_001 } from "./MFG-MIN-001";
import { evaluate as MFG_TOL_002 } from "./MFG-TOL-002";
import { evaluate as MFG_HOLE_003 } from "./MFG-HOLE-003";
import { evaluate as MFG_EDGE_005 } from "./MFG-EDGE-005";
import { evaluate as MFG_LABEL_006 } from "./MFG-LABEL-006";
import { evaluate as MFG_COMPLEX_007 } from "./MFG-COMPLEX-007";
import { evaluate as ASM_SEQ_001 } from "./ASM-SEQ-001";
import { evaluate as ASM_TOOL_002 } from "./ASM-TOOL-002";
import { evaluate as ASM_TOOLKIT_003 } from "./ASM-TOOLKIT-003";
import { evaluate as ASM_PEOPLE_004 } from "./ASM-PEOPLE-004";
import { evaluate as ASM_TILT_005 } from "./ASM-TILT-005";
import { evaluate as ASM_INSTR_006 } from "./ASM-INSTR-006";
import { evaluate as SHIP_PANEL_001 } from "./SHIP-PANEL-001";
import { evaluate as SHIP_MASS_002 } from "./SHIP-MASS-002";
import { evaluate as SHIP_PROT_003 } from "./SHIP-PROT-003";
import { evaluate as SHIP_ECON_004 } from "./SHIP-ECON-004";
import { evaluate as UX_SEV_001 } from "./UX-SEV-001";
import { evaluate as UX_CONF_002 } from "./UX-CONF-002";
import { evaluate as UX_AI_003 } from "./UX-AI-003";

export const EVALUATORS: ReadonlyMap<string, Evaluator> = new Map<string, Evaluator>([
  ["SCOPE-CAT-001", SCOPE_CAT_001],
  ["SCOPE-CAT-002", SCOPE_CAT_002],
  ["SCOPE-SIZE-003", SCOPE_SIZE_003],
  ["SCOPE-REV-004", SCOPE_REV_004],
  ["MAT-THK-001", MAT_THK_001],
  ["MAT-SIZE-002", MAT_SIZE_002],
  ["MAT-EDGE-003", MAT_EDGE_003],
  ["MAT-EDGE-004", MAT_EDGE_004],
  ["MAT-DECOR-005", MAT_DECOR_005],
  ["MAT-MOIST-006", MAT_MOIST_006],
  ["STRUCT-SHELF-001", STRUCT_SHELF_001],
  ["STRUCT-SHELF-002", STRUCT_SHELF_002],
  ["STRUCT-BACK-003", STRUCT_BACK_003],
  ["STRUCT-BACK-004", STRUCT_BACK_004],
  ["STRUCT-DIV-005", STRUCT_DIV_005],
  ["STRUCT-FIX-006", STRUCT_FIX_006],
  ["STRUCT-TOP-007", STRUCT_TOP_007],
  ["STRUCT-DESK-008", STRUCT_DESK_008],
  ["STRUCT-GEOM-009", STRUCT_GEOM_009],
  ["STAB-TRIG-001", STAB_TRIG_001],
  ["STAB-ANCHOR-002", STAB_ANCHOR_002],
  ["STAB-CALC-003", STAB_CALC_003],
  ["STAB-DRAWER-004", STAB_DRAWER_004],
  ["STAB-SHELF-005", STAB_SHELF_005],
  ["CONN-SYS-001", CONN_SYS_001],
  ["CONN-EDGE-002", CONN_EDGE_002],
  ["CONN-SPACING-003", CONN_SPACING_003],
  ["CONN-HINGE-004", CONN_HINGE_004],
  ["CONN-PIN-005", CONN_PIN_005],
  ["CONN-RUNNER-006", CONN_RUNNER_006],
  ["CONN-REUSE-007", CONN_REUSE_007],
  ["SYS32-GRID-001", SYS32_GRID_001],
  ["SYS32-SNAP-002", SYS32_SNAP_002],
  ["SYS32-GAP-003", SYS32_GAP_003],
  ["SYS32-BACK-004", SYS32_BACK_004],
  ["SYS32-PLINTH-005", SYS32_PLINTH_005],
  ["MFG-MIN-001", MFG_MIN_001],
  ["MFG-TOL-002", MFG_TOL_002],
  ["MFG-HOLE-003", MFG_HOLE_003],
  ["MFG-EDGE-005", MFG_EDGE_005],
  ["MFG-LABEL-006", MFG_LABEL_006],
  ["MFG-COMPLEX-007", MFG_COMPLEX_007],
  ["ASM-SEQ-001", ASM_SEQ_001],
  ["ASM-TOOL-002", ASM_TOOL_002],
  ["ASM-TOOLKIT-003", ASM_TOOLKIT_003],
  ["ASM-PEOPLE-004", ASM_PEOPLE_004],
  ["ASM-TILT-005", ASM_TILT_005],
  ["ASM-INSTR-006", ASM_INSTR_006],
  ["SHIP-PANEL-001", SHIP_PANEL_001],
  ["SHIP-MASS-002", SHIP_MASS_002],
  ["SHIP-PROT-003", SHIP_PROT_003],
  ["SHIP-ECON-004", SHIP_ECON_004],
  ["UX-SEV-001", UX_SEV_001],
  ["UX-CONF-002", UX_CONF_002],
  ["UX-AI-003", UX_AI_003],
]);
