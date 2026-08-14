# Myble Rules Reference

Generated from `catalogue.v1.1.0.json` (2026-07-20). Do not edit by hand —
run `node lib/rules-engine/scripts/generate-rules-reference.mjs`.

> DRAFT — pre-validation. No rule is production-approved. v1.1.0 applies Mybles sales-first severity policy: severity 4 is reserved for physical impossibilities (manufacture/ship/assemble) and stability safety; quality & durability limits are severity-3 acknowledgements with an expert recommendation. Unvalidated numbers never hard-block (schema §7 as amended by MYBLE-POLICY-2026-07-20).

| Rule | Name | Cat | Sev | Threshold | Prov. | Status | Auto-fix | Review |
|---|---|---|---|---|---|---|---|---|
| SCOPE-CAT-001 | Supported MVP product categories | product_scope | 4 | — | no | validated | no | no |
| SCOPE-CAT-002 | Hard-block safety-critical categories | product_scope | 4 | — | no | validated | no | no |
| SCOPE-SIZE-003 | MVP envelope limits | product_scope | 4 | height_max=2000, module_width_max=1200, depth_min=150, depth_max=600 | yes | requires_validation | no | yes |
| SCOPE-REV-004 | Out-of-template designs require review | product_scope | 5 | — | no | validated | no | yes |
| MAT-THK-001 | Supported material set | material | 4 | — | no | validated | no | no |
| MAT-SIZE-002 | Part must fit sheet with trim margin | material | 4 | max_length=2740, max_width=2010 | yes | requires_validation | no | no |
| MAT-EDGE-003 | Edge banding coverage | material | 4 | — | no | validated | yes | no |
| MAT-EDGE-004 | 2 mm ABS on wear edges | material | 2 | front_edge_mm=2, hidden_edge_mm=0.4 | yes | requires_validation | yes | no |
| MAT-DECOR-005 | Décor/grain direction consistency | material | 2 | — | no | validated | yes | no |
| MAT-MOIST-006 | Dry interior use only | material | 3 | — | no | validated | no | no |
| STRUCT-SHELF-001 | Maximum unsupported shelf span (18 mm LTD) | structural | 3 | hard_max_span=900, calc_zone_from=600 | yes | requires_test | no | no |
| STRUCT-SHELF-002 | Shelf deflection calculation | structural | 3 | sag_limit_mm_per_300mm=1.7, absolute_limit=L/200 | yes | requires_test | no | no |
| STRUCT-BACK-003 | Back panel required for racking resistance | structural | 3 | — | no | validated | yes | no |
| STRUCT-BACK-004 | Open-back units need triangulating bracing | structural | 3 | min_rail_width_mm=∅ | yes | requires_test | yes | no |
| STRUCT-DIV-005 | Vertical divider stiffens shelf and carcass | structural | 3 | divider_stack_offset_max_mm=50 | yes | requires_validation | yes | no |
| STRUCT-FIX-006 | Minimum structural (fixed) horizontals | structural | 3 | max_unbraced_side_height_mm=1000 | yes | requires_test | yes | no |
| STRUCT-TOP-007 | Top/desktop overhang limit | structural | 3 | overhang_max_mm=50, desktop_deflection_limit=span/250 | yes | requires_test | no | no |
| STRUCT-DESK-008 | Desk/table support spacing | structural | 3 | free_span_max=1000, rail_required_above=1000, hard_block_above=1400 | yes | requires_test | yes | no |
| STRUCT-GEOM-009 | Geometric integrity checks | structural | 4 | — | no | validated | no | no |
| STAB-TRIG-001 | Stability regime trigger | stability | 0 | height_trigger_mm=600 | no | validated | no | no |
| STAB-ANCHOR-002 | Wall-anchor mandatory for tall/narrow units | stability | 3 | always_anchor_above_height_mm=1500, anchor_if_height_mm=1000, and_ratio_h_over_d=3 | yes | requires_test | yes | no |
| STAB-CALC-003 | Tipping-moment screening calculation | stability | 4 | margin_min_loaded=∅ | yes | requires_test | no | no |
| STAB-DRAWER-004 | Multiple-drawer tall units restricted | stability | 5 | max_drawer_rows_above_800mm=1 | yes | requires_test | no | yes |
| STAB-SHELF-005 | Shelves must not dislodge | stability | 4 | retention_force_N=100 | no | requires_test | no | no |
| CONN-SYS-001 | Standard MVP connection system | connection | 4 | — | yes | requires_validation | yes | no |
| CONN-EDGE-002 | Minimum hole-to-edge distances | connection | 4 | min_edge_mm=10, min_corner_mm=50 | yes | requires_validation | yes | no |
| CONN-SPACING-003 | Connector spacing along joints | connection | 4 | third_connector_above_mm=450, back_fix_pitch_mm=300 | yes | requires_test | yes | no |
| CONN-HINGE-004 | Hinge count and door size limits | connection | 4 | hinges2_max_kg=6, hinges3_max_kg=12, width_std_max=600, width_abs_max=650 | no | requires_validation | no | no |
| CONN-PIN-005 | Adjustable-shelf pin capacity | connection | 3 | max_shelf_load_kg=31 | yes | requires_test | no | no |
| CONN-RUNNER-006 | Drawer size vs runner rating | connection | 4 | dynamic_load_kg=30, drawer_width_max_mm=900, runner_clearance_mm=10 | yes | requires_validation | no | no |
| CONN-REUSE-007 | Re-assembly durability policy | connection | 1 | confirmat_max_cycles=3 | yes | requires_validation | no | no |
| SYS32-GRID-001 | 32 mm system holes | frameless_system | 0 | hole_dia_mm=5, pitch_mm=32, front_setback_mm=37 | yes | requires_validation | yes | no |
| SYS32-SNAP-002 | Shelf positions snap to grid | frameless_system | 0 | snap_pitch_mm=32 | no | validated | yes | no |
| SYS32-GAP-003 | Door/front gaps and reveals | frameless_system | 4 | reveal_mm=2 | yes | requires_validation | yes | no |
| SYS32-BACK-004 | Back panel integration method | frameless_system | 4 | — | yes | requires_validation | yes | no |
| SYS32-PLINTH-005 | Plinth/toe-kick geometry | frameless_system | 2 | depth_mm=64, height_mm=114, tolerance_mm=25 | no | validated | yes | no |
| MFG-MIN-001 | Minimum machinable part size | manufacturing | 4 | min_length_mm=160, min_width_mm=85 | yes | requires_validation | no | yes |
| MFG-TOL-002 | Cutting & drilling tolerances | manufacturing | 0 | cut_mm=0.5, drill_mm=0.3 | yes | requires_validation | no | no |
| MFG-HOLE-003 | Hole pattern feasibility | manufacturing | 4 | min_web_mm=8, cup_min_thickness_mm=16 | yes | requires_validation | yes | no |
| MFG-EDGE-005 | Edging process constraints | manufacturing | 4 | — | no | requires_validation | yes | no |
| MFG-LABEL-006 | Part labelling & orientation marks | manufacturing | 4 | — | no | requires_validation | yes | no |
| MFG-COMPLEX-007 | Complexity cap per order | manufacturing | 5 | max_parts=60, max_unique=25, max_patterns=12 | yes | requires_validation | no | yes |
| ASM-SEQ-001 | Feasible assembly sequence must exist | assembly | 4 | — | no | validated | no | no |
| ASM-TOOL-002 | Tool access clearance | assembly | 4 | min_access_mm=120 | yes | requires_test | yes | no |
| ASM-TOOLKIT-003 | Customer toolkit is fixed | assembly | 4 | — | no | validated | no | no |
| ASM-PEOPLE-004 | Two-person flag | assembly | 0 | panel_kg=15, panel_mm=1800, unit_kg=35 | yes | requires_validation | no | no |
| ASM-TILT-005 | Tilt-up ceiling clearance | assembly | 2 | margin_mm=20 | no | validated | no | no |
| ASM-INSTR-006 | Per-order generated instructions | assembly | 4 | — | no | validated | no | no |
| SHIP-PANEL-001 | Panel length vs carrier limits | shipping | 4 | gls_max_side_mm=2000, gls_girth_mm=3000, gls_kg=40 | yes | requires_validation | no | yes |
| SHIP-MASS-002 | Package mass cap & split logic | shipping | 4 | target_kg=25, hard_kg=30 | yes | requires_validation | yes | no |
| SHIP-PROT-003 | Edge & surface protection | shipping | 4 | allowance_mm=20 | yes | requires_test | yes | no |
| SHIP-ECON-004 | Shippability economics surfaced | shipping | 1 | nudge_window_mm=30, cost_ratio_notice=0.25 | yes | validated | no | no |
| UX-SEV-001 | Severity → UI behaviour mapping | ux | 0 | — | no | validated | no | no |
| UX-CONF-002 | Acknowledgements are recorded | ux | 0 | — | no | validated | no | no |
| UX-AI-003 | AI may explain, never decide | ux | 0 | — | no | validated | no | no |

## Unvalidated safety rules (severity ≥ 4, not `validated`)

These may not fire in the live product scope without a staffed manual-review workflow (schema §7).

- **SCOPE-SIZE-003** (requires_validation, owner: manufacturing_partner+logistics) — MVP envelope limits
- **MAT-SIZE-002** (requires_validation, owner: cutting_partner) — Part must fit sheet with trim margin
- **STAB-CALC-003** (requires_test, owner: furniture_engineer+test_lab) — Tipping-moment screening calculation
- **STAB-DRAWER-004** (requires_test, owner: test_lab) — Multiple-drawer tall units restricted
- **STAB-SHELF-005** (requires_test, owner: test_lab) — Shelves must not dislodge
- **CONN-SYS-001** (requires_validation, owner: cabinetmaker+hardware_supplier) — Standard MVP connection system
- **CONN-EDGE-002** (requires_validation, owner: cnc_partner+hardware_supplier) — Minimum hole-to-edge distances
- **CONN-SPACING-003** (requires_test, owner: furniture_engineer) — Connector spacing along joints
- **CONN-HINGE-004** (requires_validation, owner: hardware_supplier) — Hinge count and door size limits
- **CONN-RUNNER-006** (requires_validation, owner: hardware_supplier) — Drawer size vs runner rating
- **SYS32-GAP-003** (requires_validation, owner: cabinetmaker) — Door/front gaps and reveals
- **SYS32-BACK-004** (requires_validation, owner: manufacturing_partner) — Back panel integration method
- **MFG-MIN-001** (requires_validation, owner: edging_partner) — Minimum machinable part size
- **MFG-HOLE-003** (requires_validation, owner: cnc_partner) — Hole pattern feasibility
- **MFG-EDGE-005** (requires_validation, owner: edging_partner) — Edging process constraints
- **MFG-LABEL-006** (requires_validation, owner: manufacturing_partner) — Part labelling & orientation marks
- **MFG-COMPLEX-007** (requires_validation, owner: manufacturing_partner) — Complexity cap per order
- **ASM-TOOL-002** (requires_test, owner: cabinetmaker) — Tool access clearance
- **SHIP-PANEL-001** (requires_validation, owner: logistics_partner) — Panel length vs carrier limits
- **SHIP-MASS-002** (requires_validation, owner: packaging_partner+logistics) — Package mass cap & split logic
- **SHIP-PROT-003** (requires_test, owner: packaging_partner) — Edge & surface protection
