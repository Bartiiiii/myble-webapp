// Growing the furniture to follow a part dragged past its current bounds.
//
// Parts live in centre-origin coordinates, so growth is symmetric: extending
// one face by X extends the opposite face by X too, which keeps every other
// part's position valid without shifting anything. The furniture can never
// grow past the same LIMITS the size sliders already enforce (in particular
// the 120 cm parcel-rule maximum).
import { LIMITS } from "../model";
import { round1 } from "./core";

export type OuterDim = "w" | "h" | "d";

/**
 * The outer dimension needed so a board whose centre wants to sit at
 * `desiredCentre` (half-size `halfSize` along that axis) still fits inside
 * the piece: at least the current size (this never shrinks the furniture),
 * and never more than that dimension's own slider maximum.
 */
export function growOuter(dim: OuterDim, currentCm: number, desiredCentre: number, halfSize: number): number {
  const neededHalf = Math.abs(desiredCentre) + halfSize;
  const grown = Math.max(currentCm, round1(neededHalf * 2));
  return Math.min(LIMITS[dim].max, grown);
}
