// ─────────────────────────────────────────────────────────────────────────────
// Units — the ONLY place unit factors live. All engine dimensions are mm,
// masses kg, forces N, stresses N/mm². Branded types prevent silently mixing
// raw numbers from other unit systems (the webapp's configurator is cm-based).
// ─────────────────────────────────────────────────────────────────────────────

export type Millimeters = number & { readonly __unit: "mm" };
export type Kilograms = number & { readonly __unit: "kg" };
export type Newtons = number & { readonly __unit: "N" };
export type NewtonsPerMm2 = number & { readonly __unit: "N/mm2" };
export type KgPerM2 = number & { readonly __unit: "kg/m2" };
export type KgPerM3 = number & { readonly __unit: "kg/m3" };

export const mm = (v: number): Millimeters => v as Millimeters;
export const kg = (v: number): Kilograms => v as Kilograms;
export const newtons = (v: number): Newtons => v as Newtons;
export const nPerMm2 = (v: number): NewtonsPerMm2 => v as NewtonsPerMm2;
export const kgPerM2 = (v: number): KgPerM2 => v as KgPerM2;
export const kgPerM3 = (v: number): KgPerM3 => v as KgPerM3;

/** Standard gravity. Used for every kg→N conversion in the engine. */
export const GRAVITY_M_S2 = 9.81;

export const cmToMm = (cm: number): Millimeters => mm(cm * 10);
export const mmToM = (v: Millimeters): number => (v as number) / 1000;
export const mm2ToM2 = (v: number): number => v / 1e6;

export const kgToN = (m: Kilograms): Newtons => newtons((m as number) * GRAVITY_M_S2);

/** EN 16122 shelf loading is quoted in kg/dm²; engine works in kg/m². */
export const kgPerDm2ToKgPerM2 = (v: number): KgPerM2 => kgPerM2(v * 100);
