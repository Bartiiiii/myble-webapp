// Bundled catalogues. The engine ships the current version and N−1 so stored
// orders re-validate against the exact version they were placed under
// (implementation task 7 / schema §6.4). `CURRENT_CATALOGUE` is what the live
// configurator and checkout use by default.

import catalogueV1_0_0 from "./catalogue.v1.0.0.json";
import catalogueV1_1_0 from "./catalogue.v1.1.0.json";

export const CURRENT_CATALOGUE = catalogueV1_1_0;
export const PREVIOUS_CATALOGUE = catalogueV1_0_0;

/** Look up a bundled catalogue by version (for stored-order replay). */
export const CATALOGUES_BY_VERSION: Record<string, unknown> = {
  "1.0.0": catalogueV1_0_0,
  "1.1.0": catalogueV1_1_0,
};

export function catalogueForVersion(version: string): unknown {
  const found = CATALOGUES_BY_VERSION[version];
  if (!found) throw new Error(`no bundled catalogue for version ${version}`);
  return found;
}
