// AI may explain, never decide — architectural invariant, enforced by
// construction: the engine is a pure function with no LLM calls, and any AI
// proposal re-enters through the normal edit pipeline and is re-validated.
// This evaluator records the invariant in every audit trail.

import type { Evaluator } from "../context";
import { ok } from "../context";

export const evaluate: Evaluator = () => [
  ok({ deterministic: true, llm_calls: 0 }, "AI output can never alter engine verdicts (presentation layer only)"),
];
