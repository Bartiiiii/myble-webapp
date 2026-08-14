// Canonical JSON serialisation: object keys sorted, no undefined, stable number
// formatting. `hashOf(x)` is the audit identity used for design_hash,
// inputs_hash and message_hash — same value ⇒ byte-identical serialisation.

import { sha256Hex } from "./sha256";

export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(v: unknown): string {
  if (v === null || v === undefined) return "null";
  switch (typeof v) {
    case "number":
      if (!Number.isFinite(v)) throw new Error("canonicalJson: non-finite number");
      return Object.is(v, -0) ? "0" : JSON.stringify(v);
    case "boolean":
    case "string":
      return JSON.stringify(v);
    case "object": {
      if (Array.isArray(v)) return "[" + v.map(serialize).join(",") + "]";
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
      return "{" + keys.map((k) => JSON.stringify(k) + ":" + serialize(obj[k])).join(",") + "}";
    }
    default:
      throw new Error(`canonicalJson: unsupported type ${typeof v}`);
  }
}

export function hashOf(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
