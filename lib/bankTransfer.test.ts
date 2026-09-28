import { describe, it, expect } from "vitest";
import { variableSymbolFromOrderNo } from "./bankTransfer";

// The variable symbol is what lets Barti match an incoming transfer to an order.
// A VS containing letters is rejected or silently mangled by CZ banks, so the
// numeric-only guarantee is the whole point of this helper.
describe("variableSymbolFromOrderNo", () => {
  it("strips the letters and dashes out of a normal order number", () => {
    expect(variableSymbolFromOrderNo("MB-2026-1234")).toBe("20261234");
  });

  it("caps at 10 digits, the CZ bank limit", () => {
    const vs = variableSymbolFromOrderNo("MB-2026-1234-567890");
    expect(vs).toBe("2026123456");
    expect(vs.length).toBe(10);
  });

  it("returns an empty string when there are no digits at all, rather than throwing", () => {
    expect(variableSymbolFromOrderNo("MB-ORDER")).toBe("");
    expect(variableSymbolFromOrderNo("")).toBe("");
  });

  it("only ever emits digits", () => {
    for (const input of ["MB-2026-1234", "mb/2026/0001", "  MB 2026 9999  "]) {
      expect(variableSymbolFromOrderNo(input)).toMatch(/^\d*$/);
    }
  });
});
