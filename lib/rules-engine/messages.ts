// Message rendering (implementation task 5): templates from the catalogue's
// user_message with {placeholders} filled from finding.computed. CS strings
// come from the locale file keyed by rule_id; missing translations fall back
// to EN with a logged warning — never a crash.

import { sha256Hex } from "./sha256";
import { CS_MESSAGES } from "./locales/cs";
import type { ValidationFinding } from "./report";
import type { Rule } from "./types";

export type Locale = "en" | "cs";
export type WarnLogger = (message: string) => void;

export function renderMessage(
  rule: Rule,
  finding: ValidationFinding,
  locale: Locale,
  warn: WarnLogger = (m) => console.warn(m),
): string | null {
  const en = rule.user_message?.en;
  let template: string | undefined;
  if (locale === "cs") {
    template = CS_MESSAGES[rule.rule_id];
    if (template === undefined && en !== undefined && en !== null) {
      warn(`rules-engine: missing cs translation for ${rule.rule_id}, falling back to en`);
      template = en;
    }
  } else {
    template = en ?? undefined;
  }
  if (template === undefined || template === null) return null;

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, key: string) => {
    const value = finding.computed[key];
    if (value === undefined || value === null) {
      warn(`rules-engine: message placeholder {${key}} missing in computed values of ${rule.rule_id}`);
      return whole;
    }
    return String(value);
  });
}

/** Hash of the exact message text shown — stored with acknowledgements. */
export function messageHash(text: string): string {
  return sha256Hex(text);
}
