import { NextResponse } from "next/server";
import { backstageApiStatus } from "@/lib/adminAuth";
import { ORDER_STATUSES, fetchOrders } from "@/lib/backstageData";
import { coerceDesign } from "@/lib/build";
import {
  type MebleItem,
  drillingSheetCSV,
  mebleBatchSummary,
  mebleBatches,
  mebleCutlistCSV,
} from "@/lib/mebleExport";

// The meble.pl production files for a set of orders.
//
//   GET /api/admin/export/meble?ids=…            → JSON manifest (what's in the batch)
//   GET /api/admin/export/meble?ids=…&material=white_18&file=cutlist
//   …&file=drilling | summary
//
// Select the orders by `ids` (comma-separated) or by `status`. Batches are per
// material because meble's importer loads into one selected board: everything
// in White 18 mm is a single upload, whatever it came from.

type FileKind = "cutlist" | "drilling" | "summary";

const FILES: Record<FileKind, { render: (b: ReturnType<typeof mebleBatches>[number]) => string; ext: string; mime: string }> = {
  cutlist: { render: mebleCutlistCSV, ext: "csv", mime: "text/csv; charset=utf-8" },
  drilling: { render: drillingSheetCSV, ext: "csv", mime: "text/csv; charset=utf-8" },
  summary: { render: mebleBatchSummary, ext: "txt", mime: "text/plain; charset=utf-8" },
};

export async function GET(req: Request) {
  const status = await backstageApiStatus();
  if (status) return NextResponse.json({ ok: false }, { status });

  const params = new URL(req.url).searchParams;
  const ids = (params.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const statusFilter = params.get("status") ?? undefined;
  if (statusFilter && !(ORDER_STATUSES as readonly string[]).includes(statusFilter)) {
    return NextResponse.json({ ok: false, error: "unknown_status" }, { status: 400 });
  }
  if (ids.length === 0 && !statusFilter) {
    return NextResponse.json({ ok: false, error: "no_selection" }, { status: 400 });
  }

  const orders = await fetchOrders(statusFilter);
  const selected = ids.length ? orders.filter((o) => ids.includes(o.id)) : orders;

  // An order whose design JSON we can't read is a production stop, not a row to
  // skip quietly — surface it next to the files.
  const items: MebleItem[] = [];
  const unreadable: string[] = [];
  for (const order of selected) {
    const design = coerceDesign(order.design ?? order.design_spec);
    if (design) items.push({ ref: order.order_no, design });
    else unreadable.push(order.order_no);
  }

  const batches = mebleBatches(items);
  const material = params.get("material");
  const file = params.get("file") as FileKind | null;

  if (!file) {
    return NextResponse.json({
      ok: true,
      orders: selected.length,
      unreadable,
      batches: batches.map((b) => ({
        materialId: b.materialId,
        materialLabel: b.materialLabel,
        ...b.totals,
        warnings: b.warnings,
        refs: [...new Set(b.formatki.map((f) => f.ref))],
      })),
    });
  }

  if (!FILES[file]) {
    return NextResponse.json({ ok: false, error: "unknown_file" }, { status: 400 });
  }
  const batch = material ? batches.find((b) => b.materialId === material) : batches[0];
  if (!batch) {
    return NextResponse.json({ ok: false, error: "no_batch" }, { status: 404 });
  }

  const spec = FILES[file];
  // meble print the file name on the labels they stick to the parts, so name it
  // after what's inside: one order by its number, a run by its date.
  const refs = [...new Set(batch.formatki.map((f) => f.ref))];
  const who = refs.length === 1 ? refs[0] : `run-${new Date().toISOString().slice(0, 10)}`;
  const name = `myble-${who}-${batch.materialId.replace("_", "")}${file === "cutlist" ? "" : `-${file}`}`;

  return new NextResponse(spec.render(batch), {
    headers: {
      "Content-Type": spec.mime,
      "Content-Disposition": `attachment; filename="${name}.${spec.ext}"`,
    },
  });
}
