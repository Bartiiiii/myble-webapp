import { NextResponse } from "next/server";
import { backstageApiStatus } from "@/lib/adminAuth";
import { isCuratedId, publishCuratedOverride, revertCuratedOverride } from "@/lib/curatedOverrides";
import { isPartsDesign, validate } from "@/lib/design";
import type { Design } from "@/lib/model";

// Backstage edits of one curated (house) library design.
//
// PUT    { design } → { ok, version }  publish an updated version
// DELETE            → { ok }           revert to the version in lib/library.ts
//
// Only curated ids are accepted: community designs belong to the people who
// shared them and are reviewed, never edited. A design that fails the same
// validator the configurator runs is refused, so backstage cannot publish a
// piece that greets customers with red boxes.

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const status = await backstageApiStatus();
  if (status) return NextResponse.json({ ok: false }, { status });

  const { id } = await ctx.params;
  if (!isCuratedId(id)) return NextResponse.json({ ok: false, error: "not_curated" }, { status: 404 });

  let body: { design?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!isPartsDesign(body.design)) {
    return NextResponse.json({ ok: false, error: "invalid_design" }, { status: 400 });
  }
  const design = body.design as Design;
  if (validate(design).errors.length > 0) {
    return NextResponse.json({ ok: false, error: "design_has_errors" }, { status: 422 });
  }

  try {
    const version = await publishCuratedOverride(id, design);
    return NextResponse.json({ ok: true, version });
  } catch (e) {
    console.error("[admin/library] publish failed", { id, error: (e as Error).message });
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const status = await backstageApiStatus();
  if (status) return NextResponse.json({ ok: false }, { status });

  const { id } = await ctx.params;
  if (!isCuratedId(id)) return NextResponse.json({ ok: false, error: "not_curated" }, { status: 404 });

  try {
    await revertCuratedOverride(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/library] revert failed", { id, error: (e as Error).message });
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }
}
