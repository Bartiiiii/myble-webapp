import { describe, it, expect } from "vitest";
import { quoteDesign, designToCutParts, breakdownCZK, priceFromMeble, ceilTo90, FROM_PRICE } from "./quote";
import { calculatePrice } from "./pricing";
import { DEFAULT_DESIGN, presetDesign } from "./build";
import { type Design, type Part } from "./model";
import { DELIVERY_CZK, IN_ROOM_DELIVERY_SURCHARGE_CZK } from "./model";
import { FREE_SHIP_CZK, PRICE_FLOOR_CZK } from "./pricingConfig";

describe("designToCutParts", () => {
  it("emits a cut part per board (grouped), drilled, in mm", () => {
    const d = presetDesign("stolek"); // 4 walls + 1 shelf
    const parts = designToCutParts(d);
    const totalBoards = parts.reduce((n, p) => n + (p.quantity ?? 1), 0);
    expect(totalBoards).toBe(5);
    // In a box every board joins something ⇒ drilled.
    expect(parts.every((p) => p.drilled)).toBe(true);
    expect(parts.every((p) => Number.isInteger(p.widthMm) && p.widthMm > 0)).toBe(true);
    // Edge banding is present (geometry-derived).
    expect(parts.every((p) => p.edgeBanding !== undefined)).toBe(true);
  });

  it("a lone board is not drilled and is fully banded", () => {
    const shelf: Part = { id: "s", role: "shelf", axis: "y", aCm: 40, bCm: 30, pos: { x: 0, y: 0, z: 0 } };
    const d: Design = { colour: "white", thickness: 18, outerCm: { w: 40, h: 40, d: 30 }, parts: [shelf] };
    const parts = designToCutParts(d);
    expect(parts).toHaveLength(1);
    expect(parts[0].drilled).toBe(false);
    expect(parts[0].edgeBanding).toEqual({ top: true, bottom: true, left: true, right: true });
  });
});

describe("ceilTo90", () => {
  it("rounds up to the next multiple of 90", () => {
    expect(ceilTo90(3346.2)).toBe(3420);
    expect(ceilTo90(2790)).toBe(2790); // already a multiple
    expect(ceilTo90(2790.01)).toBe(2880);
  });
});

describe("priceFromMeble — the §6 landed-cost + markup formula", () => {
  // §3 unit-economics: the doc's flagship meble cost is ~240 PLN gross. Feeding
  // exactly that reproduces the doc's published prices to the koruna.
  it("reproduces the §3 flagship price from the doc's 240 PLN meble cost", () => {
    expect(priceFromMeble(240, { vatRegistered: false }).price).toBe(3420); // §3 gross
    expect(priceFromMeble(240, { vatRegistered: true }).price).toBe(2880); // §3 net
  });

  it("markup ×2 yields ~50% gross margin by construction", () => {
    const cz = priceFromMeble(240, { vatRegistered: false });
    expect(cz.marginPct).toBeGreaterThan(0.48);
    expect(cz.marginPct).toBeLessThan(0.56);
  });

  it("VAT registration lowers the ex-VAT price at the same margin", () => {
    expect(priceFromMeble(240, { vatRegistered: true }).price).toBeLessThan(
      priceFromMeble(240, { vatRegistered: false }).price,
    );
  });

  it("flags a design that exceeds its WTP ceiling", () => {
    const cheap = priceFromMeble(240, { vatRegistered: false, wtpCeilingCZK: 3490 });
    expect(cheap.exceedsWTP).toBe(false);
    const dear = priceFromMeble(600, { vatRegistered: false, wtpCeilingCZK: 3490 });
    expect(dear.exceedsWTP).toBe(true);
  });
});

describe("quoteDesign — flagship shelf (73×118×30, 3 shelves)", () => {
  // The doc's flagship = front-edge banding, all drilled. Built explicitly so the
  // banding matches §3; geometry lands within a rounding bucket of 3,420 / 2,880.
  const flagship = [
    { name: "side", widthMm: 1180, heightMm: 300, quantity: 2, drilled: true, edgeBanding: { left: true } },
    { name: "horiz", widthMm: 694, heightMm: 300, quantity: 5, drilled: true, edgeBanding: { top: true } },
  ];
  const meble = calculatePrice({ materialId: "white_18", parts: flagship, tier: "premium" }).mebleCostPLN;

  it("lands ~CZK 3,420 at MARKUP 2.0 / VAT_REGISTERED false", () => {
    const price = priceFromMeble(meble, { vatRegistered: false }).price;
    expect(price).toBeGreaterThanOrEqual(3200);
    expect(price).toBeLessThanOrEqual(3600);
  });

  it("lands ~CZK 2,880 when VAT_REGISTERED true", () => {
    const price = priceFromMeble(meble, { vatRegistered: true }).price;
    expect(price).toBeGreaterThanOrEqual(2650);
    expect(price).toBeLessThanOrEqual(3050);
  });

  it("the shipped police preset is the flagship and quotes sanely", () => {
    const q = quoteDesign(presetDesign("police"));
    expect(q.sticker).toBe(q.kitCZK);
    expect(q.total).toBe(q.customerCZK);
    expect(q.customerCZK).toBe(q.sticker + q.deliveryCZK);
    expect(q.marginPct).toBeGreaterThan(0.45);
    expect(q.mebleCostPLN).toBeGreaterThan(0);
  });
});

describe("quoteDesign — behaviour", () => {
  it("produces a sane CZK total with a full meble breakdown", () => {
    const q = quoteDesign(DEFAULT_DESIGN);
    expect(q.customerCZK).toBeGreaterThan(500);
    expect(q.customerCZK).toBeLessThan(30000);
    expect(q.customerCZK).toBe(q.kitCZK + q.deliveryCZK);

    expect(q.mebleCostPLN).toBeGreaterThan(0);
    const labels = q.pricing.lines.map((l) => l.label);
    expect(labels).toContain("Board material");
    expect(labels).toContain("Cutting");

    // Landed CZK is above the raw meble cost converted at FX (adds fixed CZK adders).
    expect(q.landedCZK).toBeGreaterThan(q.mebleCostPLN);
    expect(q.sticker).toBeGreaterThan(q.landedCZK); // markup > 1
  });

  it("bills edge banding on all four edges of every board", () => {
    const q = quoteDesign(DEFAULT_DESIGN);
    const parts = designToCutParts(DEFAULT_DESIGN);
    // Every cut part asks for all four edges…
    for (const p of parts) {
      expect(p.edgeBanding).toEqual({ top: true, bottom: true, left: true, right: true });
    }
    // …so the billed edge metres cover the full perimeter of every piece.
    const perimeterM =
      parts.reduce((m, p) => m + 2 * (p.widthMm + p.heightMm) * (p.quantity ?? 1), 0) / 1000;
    expect(q.pricing.detail.edgeActualMetres).toBeCloseTo(perimeterM, 3);
  });

  it("the CZK breakdown components sum EXACTLY to the kit sticker", () => {
    const q = quoteDesign(presetDesign("police"));
    const lines = breakdownCZK(q);
    expect(lines.length).toBeGreaterThan(3);
    const sum = lines.reduce((n, l) => n + l.czk, 0);
    expect(sum).toBe(q.sticker); // margin line closes the gap → exact
    expect(lines.some((l) => l.estimate)).toBe(true); // cutting flagged estimated
    expect(lines.some((l) => l.key === "board")).toBe(true);
    expect(lines.some((l) => l.key === "margin")).toBe(true);
  });

  it("prices every preset in a sane band; bigger pieces cost more", () => {
    const police = quoteDesign(presetDesign("police"));
    const stolek = quoteDesign(presetDesign("stolek"));
    for (const q of [police, stolek]) {
      expect(q.customerCZK).toBeGreaterThan(500);
      expect(q.customerCZK).toBeLessThan(30000);
    }
    expect(police.kitCZK).toBeGreaterThan(stolek.kitCZK);
    expect(FROM_PRICE.police).toBe(police.kitCZK);
  });
});

describe("quoteDesign — floor & delivery", () => {
  const tiny: Design = {
    colour: "white",
    thickness: 18,
    outerCm: { w: 20, h: 20, d: 15 },
    parts: [{ id: "s", role: "shelf", axis: "y", aCm: 10, bCm: 10, pos: { x: 0, y: 0, z: 0 } }],
  };

  it("never prices below PRICE_FLOOR_CZK", () => {
    const q = quoteDesign(tiny);
    expect(q.price).toBe(PRICE_FLOOR_CZK);
  });

  it("charges delivery below the free-ship threshold", () => {
    const q = quoteDesign(tiny);
    expect(q.price).toBeLessThan(FREE_SHIP_CZK);
    expect(q.deliveryCZK).toBe(DELIVERY_CZK);
  });

  it("delivery is free at/above FREE_SHIP_CZK", () => {
    const q = quoteDesign(presetDesign("police")); // ≥ 3000
    expect(q.price).toBeGreaterThanOrEqual(FREE_SHIP_CZK);
    expect(q.deliveryCZK).toBe(0);
  });
});

// The in-room surcharge is the one number the customer picks that the server has
// to reproduce exactly: assertPriceMatches() in lib/payments.ts is zero-tolerance,
// so a client/server disagreement here is a hard checkout failure, not a rounding
// nit. These lock the arithmetic down on both sides of the free-ship threshold.
describe("quoteDesign — in-room delivery surcharge", () => {
  const tiny: Design = {
    colour: "white",
    thickness: 18,
    outerCm: { w: 20, h: 20, d: 15 },
    parts: [{ id: "s", role: "shelf", axis: "y", aCm: 10, bCm: 10, pos: { x: 0, y: 0, z: 0 } }],
  };
  const empty: Design = { colour: "white", thickness: 18, outerCm: { w: 0, h: 0, d: 0 }, parts: [] };

  it("curbside (and omitted) charge no surcharge", () => {
    expect(quoteDesign(tiny, { deliveryMethod: "curbside" }).deliveryCZK).toBe(DELIVERY_CZK);
    expect(quoteDesign(tiny).deliveryCZK).toBe(DELIVERY_CZK);
  });

  it("adds the surcharge on top of a charged base fee", () => {
    const q = quoteDesign(tiny, { deliveryMethod: "in-room" });
    expect(q.price).toBeLessThan(FREE_SHIP_CZK);
    expect(q.deliveryCZK).toBe(DELIVERY_CZK + IN_ROOM_DELIVERY_SURCHARGE_CZK);
  });

  // Business rule per the in-room fix: the surcharge is a service fee, so free
  // curbside shipping does not make in-room free too.
  it("still applies when base delivery is free", () => {
    const q = quoteDesign(presetDesign("police"), { deliveryMethod: "in-room" });
    expect(q.price).toBeGreaterThanOrEqual(FREE_SHIP_CZK);
    expect(q.deliveryCZK).toBe(IN_ROOM_DELIVERY_SURCHARGE_CZK);
  });

  it("flows into the customer total, not just the delivery line", () => {
    const curbside = quoteDesign(presetDesign("police"), { deliveryMethod: "curbside" });
    const inRoom = quoteDesign(presetDesign("police"), { deliveryMethod: "in-room" });
    expect(inRoom.customerCZK - curbside.customerCZK).toBe(IN_ROOM_DELIVERY_SURCHARGE_CZK);
    expect(inRoom.total).toBe(inRoom.kitCZK + inRoom.deliveryCZK);
  });

  it("applies to the empty-design branch too", () => {
    expect(quoteDesign(empty).deliveryCZK).toBe(DELIVERY_CZK);
    const q = quoteDesign(empty, { deliveryMethod: "in-room" });
    expect(q.deliveryCZK).toBe(DELIVERY_CZK + IN_ROOM_DELIVERY_SURCHARGE_CZK);
    expect(q.total).toBe(q.deliveryCZK);
  });
});
