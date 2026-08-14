// Web Worker entry: runs full rules validation off the main thread so the 3D
// configurator stays responsive during edits. The engine is a pure, dependency
// -free function, so it runs identically here and on the main thread (the hook
// falls back to main-thread execution when workers are unavailable).

/// <reference lib="webworker" />

import type { Design } from "../../model";
import { validateConfiguratorDesign, type ValidateConfiguratorOptions, type UiReport } from "../configurator";

export interface ValidationRequest {
  /** Correlates responses with requests (the hook keeps only the latest). */
  seq: number;
  design: Design;
  options?: ValidateConfiguratorOptions;
}

export interface ValidationResponse {
  seq: number;
  ok: boolean;
  report?: UiReport;
  error?: string;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<ValidationRequest>) => {
  const { seq, design, options } = event.data;
  try {
    const report = validateConfiguratorDesign(design, options);
    const response: ValidationResponse = { seq, ok: true, report };
    ctx.postMessage(response);
  } catch (error) {
    const response: ValidationResponse = {
      seq,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    ctx.postMessage(response);
  }
};
