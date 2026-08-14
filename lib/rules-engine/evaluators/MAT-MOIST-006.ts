// Dry interior use only (P2 board, service class 1). Fires as a severity-3
// acknowledgement when the customer states a wet-room intent.

import type { Evaluator } from "../context";
import { notApplicable, ok, violated } from "../context";

export const evaluate: Evaluator = (design) => {
  const intent = design.unit.room_intent ?? null;
  if (intent === null) return [notApplicable("room intent not provided")];
  if (intent === "bathroom" || intent === "utility") {
    return [violated({ computed: { room_intent: intent } })];
  }
  return [ok({ room_intent: intent })];
};
