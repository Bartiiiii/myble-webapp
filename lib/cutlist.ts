// ─────────────────────────────────────────────────────────────────────────────
// meble cut-list export — what Barti pastes/uploads to place the meble.pl order.
// ─────────────────────────────────────────────────────────────────────────────
// Turns a Design into the exact part list meble bills: each board in MILLIMETRES,
// which edges are banded, and whether it's drilled. Re-uses designToCutParts so
// the export matches the price to the part.

import { type Design, type EdgeKey, type Role, materialId } from "./model";
import { designToCutParts } from "./quote";

// Material + role labels for the EXPORT FILE (supplier-facing, stable English —
// not the localized UI, which translates via i18n).
const MATERIAL_LABEL: Record<string, string> = {
  white_18: "White 18 mm",
  black_18: "Black 18 mm",
  white_36: "White 36 mm",
  black_36: "Black 36 mm",
};
const ROLE_LABEL: Record<Role, string> = { wall: "Wall", shelf: "Shelf", divider: "Divider" };

export interface CutListRow {
  /** Part role (for the localized on-screen table). */
  role: Role;
  /** English label for the export file. */
  name: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
  /** Banded edges as a compact code, e.g. "T,B,L,R" (top/bottom/left/right). */
  banding: string;
  drilled: boolean;
}

const EDGE_CODE: Record<EdgeKey, string> = { top: "T", bottom: "B", left: "L", right: "R" };

export function cutListRows(design: Design): CutListRow[] {
  return designToCutParts(design).map((p) => {
    const e = p.edgeBanding ?? { top: true, bottom: true, left: true, right: true };
    const banding = (Object.keys(EDGE_CODE) as EdgeKey[])
      .filter((k) => e[k])
      .map((k) => EDGE_CODE[k])
      .join(",");
    const role = (p.name ?? "shelf") as Role;
    return {
      role,
      name: ROLE_LABEL[role] ?? "Part",
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      quantity: p.quantity ?? 1,
      banding: banding || "—",
      drilled: !!p.drilled,
    };
  });
}

export interface CutListExport {
  generatedAt: string;
  materialId: string;
  materialLabel: string;
  colour: string;
  thicknessMm: number;
  outerCm: { w: number; h: number; d: number };
  rows: CutListRow[];
  totalBoards: number;
}

export function cutListData(design: Design): CutListExport {
  const rows = cutListRows(design);
  const id = materialId(design);
  return {
    generatedAt: new Date().toISOString(),
    materialId: id,
    materialLabel: MATERIAL_LABEL[id] ?? id,
    colour: design.colour === "black" ? "Black" : "White",
    thicknessMm: design.thickness,
    outerCm: design.outerCm,
    rows,
    totalBoards: rows.reduce((n, r) => n + r.quantity, 0),
  };
}

export function cutListJSON(design: Design): string {
  return JSON.stringify(cutListData(design), null, 2);
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function cutListCSV(design: Design): string {
  const data = cutListData(design);
  const lines: string[] = [];
  lines.push(`# Myble cut list (meble) — ${data.materialLabel}`);
  lines.push(`# Size ${data.outerCm.w}×${data.outerCm.h}×${data.outerCm.d} cm · all edges banded`);
  lines.push(["part", "width_mm", "height_mm", "qty", "edges", "drilled"].join(","));
  for (const r of data.rows) {
    lines.push([r.name, r.widthMm, r.heightMm, r.quantity, r.banding, r.drilled ? "yes" : "no"].map(csvCell).join(","));
  }
  return lines.join("\n");
}

/** Trigger a browser download of the cut list (client-only). */
export function downloadCutList(design: Design, format: "csv" | "json"): void {
  if (typeof window === "undefined") return;
  const content = format === "csv" ? cutListCSV(design) : cutListJSON(design);
  const mime = format === "csv" ? "text/csv;charset=utf-8" : "application/json";
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `myble-rezaci-plan.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
