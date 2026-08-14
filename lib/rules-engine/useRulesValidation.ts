"use client";

// React hook: live rules validation for the configurator. Runs the engine in a
// Web Worker (keeping the 3D editor smooth during drags), debounced on
// committed edits, with a graceful main-thread fallback when workers are
// unavailable (SSR, older browsers, worker construction failure).

import { useEffect, useMemo, useRef, useState } from "react";
import type { Design } from "../model";
import { validateConfiguratorDesign, type UiReport, type ValidateConfiguratorOptions } from "./configurator";
import type { ValidationRequest, ValidationResponse } from "./worker/validation.worker";

const DEBOUNCE_MS = 120;

export interface UseRulesValidation {
  report: UiReport | null;
  /** True between an edit and its validation result landing. */
  validating: boolean;
}

export function useRulesValidation(design: Design, options?: ValidateConfiguratorOptions): UseRulesValidation {
  const [report, setReport] = useState<UiReport | null>(null);
  const [validating, setValidating] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);
  const latestApplied = useRef(0);
  // Stringify options so a fresh object literal each render doesn't re-fire.
  const optionsKey = JSON.stringify(options ?? {});

  // Lazily construct the worker once; fall back to main-thread on any failure.
  useEffect(() => {
    if (typeof window === "undefined" || typeof Worker === "undefined") return;
    try {
      const worker = new Worker(new URL("./worker/validation.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<ValidationResponse>) => {
        const { seq, ok, report: result } = event.data;
        if (seq < latestApplied.current) return; // stale — a newer edit superseded it
        latestApplied.current = seq;
        if (ok && result) setReport(result);
        setValidating(false);
      };
      worker.onerror = () => {
        // Worker died — drop it and let the effect below run main-thread.
        worker.terminate();
        workerRef.current = null;
      };
      workerRef.current = worker;
      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      workerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const seq = ++seqRef.current;
    setValidating(true);
    const parsedOptions = JSON.parse(optionsKey) as ValidateConfiguratorOptions;

    const timer = setTimeout(() => {
      const worker = workerRef.current;
      if (worker) {
        const request: ValidationRequest = { seq, design, options: parsedOptions };
        worker.postMessage(request);
      } else {
        // Main-thread fallback (also the SSR-safe path). ~1 ms for ≤60 parts.
        try {
          const result = validateConfiguratorDesign(design, parsedOptions);
          if (seq >= latestApplied.current) {
            latestApplied.current = seq;
            setReport(result);
          }
        } catch {
          /* leave the previous report in place on a transient error */
        } finally {
          setValidating(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [design, optionsKey]);

  return useMemo(() => ({ report, validating }), [report, validating]);
}
