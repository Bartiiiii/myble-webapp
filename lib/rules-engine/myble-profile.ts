// Myble's live partner/carrier profile. Values here are what the configurator
// assumes about the current manufacturing + logistics setup. Capabilities that
// are still unconfirmed are left null so the engine ADVISES (never hard-blocks)
// until ops confirms them — per the 2026-07-20 sales-first policy.
//
// TODO(ops): replace the null capabilities and the `verified: null` carrier
// dates with confirmed partner data; that turns the corresponding advisories
// into hard checks where appropriate.

import type { PartnerProfile } from "./profiles";
import { DEFAULT_CARRIER_PROFILES } from "./profiles";

export const MYBLE_PARTNER_PROFILE: PartnerProfile = {
  partner_id: "myble_2026_07",
  capabilities: {
    // 2 mm ABS + premill: not yet confirmed with the edging partner → advisory.
    edging_2mm: null,
    premill: null,
    // The configurator ships open panel furniture; when a back is used it is a
    // surface-screwed HDF overlay (the RTA-simplest method).
    back_methods: ["overlay_screwed"],
  },
  // Cut/drill tolerances not yet contractually confirmed → engine uses the
  // catalogue provisional values (MFG-TOL-002 stays informational).
  tolerances: null,
};

export { DEFAULT_CARRIER_PROFILES as MYBLE_CARRIER_PROFILES };
