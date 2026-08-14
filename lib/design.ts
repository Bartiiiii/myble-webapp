// App-facing barrel for the Myble furniture model: re-exports the pure model +
// geometry engine + builders, and owns persistence, labels and CZK formatting.
//
// Pricing lives in `lib/quote.ts` (it imports this module — one-directional, so
// nothing here may import pricing). The 3D editor and pages import from here.

export * from "./model";
export * from "./build";
export {
  validate,
  type Validation,
  type Issue,
  scaleParts,
  snap,
  type SnapResult,
  contactGraph,
  connectivity,
  type Connectivity,
  detectJoints,
  type Joint,
  bandedEdges,
  exposedEdges,
  SNAP_CM,
  DOWEL_DIAM_MM,
} from "./geometry";

import type { Design } from "./model";
import { DEFAULT_DESIGN, legacyToDesign, type LegacyDesign } from "./build";

// Labels (designLabel / partsLabel) and CZK formatting now live in lib/i18n —
// they're locale-dependent and rendered in the React layer.

// --- Persistence (localStorage, SSR-safe) ----------------------------------
const STORAGE_KEY = "myble.design.v3";
const LEGACY_KEYS = ["myble.design.v2", "myble.design.v1"];

export function saveDesign(d: Design): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

function isPartsDesign(v: unknown): v is Design {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as Design).parts) &&
    typeof (v as Design).outerCm === "object"
  );
}

export function loadDesign(): Design {
  if (typeof window === "undefined") return DEFAULT_DESIGN;
  try {
    const rawV3 = window.localStorage.getItem(STORAGE_KEY);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (isPartsDesign(parsed)) return parsed;
    }
    // Migrate the newest legacy (plank) design we can find.
    for (const key of LEGACY_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = JSON.parse(raw) as LegacyDesign;
      if (typeof legacy.widthCm === "number") {
        const migrated = legacyToDesign(legacy);
        saveDesign(migrated); // persist under v3 so we only migrate once
        return migrated;
      }
    }
    return DEFAULT_DESIGN;
  } catch {
    return DEFAULT_DESIGN;
  }
}

// CZK formatting is locale-aware now and lives in lib/i18n (`useI18n().fmt`).
