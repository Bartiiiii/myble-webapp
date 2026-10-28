// Presentation fallbacks for rules whose catalogue entry has no user message.
//
// The catalogue's `user_message` is null for several rules that DO fire on
// ordinary configurator designs — MFG-EDGE-005 on every single one — so the
// finding reached the UI and the order record as an empty string (or the bare
// English rule name). The engine core keeps its contract (`renderMessage`
// returns null when the catalogue has nothing); the configurator facade fills
// the gap from here. Move these into the catalogue's `user_message` in the
// next catalogue release and delete the entry here.
//
// The Czech strings still want a native speaker's read (see locales/cs.ts).

import type { Locale } from "../messages";

export const FALLBACK_MESSAGES: Record<string, Record<Locale, string>> = {
  "MFG-EDGE-005": {
    en: "Every edge gets 2 mm ABS banding. Where our cutting partner can't apply 2 mm, that board is banded with 1 mm instead. Nothing changes for you.",
    cs: "Všechny hrany olepujeme 2mm ABS hranou. Kde ji náš partner nanést nemůže, dostane deska 1mm hranu. Pro vás se nic nemění.",
  },
  "ASM-TOOL-002": {
    en: "Two boards sit less than 12 cm apart, too tight to reach the fittings with a screwdriver. Move them at least 12 cm apart.",
    cs: "Dvě desky jsou od sebe méně než 12 cm, ke spojům se tam šroubovákem nedostanete. Posuňte je alespoň 12 cm od sebe.",
  },
  "MAT-THK-001": {
    en: "One of the boards is a material we don't cut for that part. We'll check it with you before production.",
    cs: "Jedna z desek je z materiálu, který pro tento díl neřežeme. Před výrobou to s vámi ověříme.",
  },
  "MAT-EDGE-003": {
    en: "An exposed edge has no banding. We band every edge, so it will be banded.",
    cs: "Jedna viditelná hrana není olepená. Olepujeme všechny hrany, takže ji olepíme.",
  },
  "SHIP-MASS-002": {
    en: "One package would be heavier than a courier takes. We'll split the parts into more packages.",
    cs: "Jeden balík by byl těžší, než kurýr převeze. Díly rozdělíme do více balíků.",
  },
  "SYS32-BACK-004": {
    en: "How the back panel is fixed still needs our partner's confirmation. We'll confirm it before production.",
    cs: "Způsob uchycení zadní desky ještě potvrzujeme s partnerem. Ověříme ho před výrobou.",
  },
};

/** The fallback text for a rule with no catalogue message, or null. */
export function fallbackMessage(ruleId: string, locale: Locale): string | null {
  return FALLBACK_MESSAGES[ruleId]?.[locale] ?? null;
}
