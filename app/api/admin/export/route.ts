import { NextResponse } from "next/server";
import { backstageApiStatus } from "@/lib/adminAuth";
import { createAdminClient } from "@/utils/supabase/admin";

// CSV export for backstage tables. GET /api/admin/export?what=orders|newsletter|messages|designs

type Row = Record<string, unknown>;

const EXPORTS: Record<string, { table: string; columns: string[]; order: string }> = {
  orders: {
    table: "orders",
    columns: [
      "order_no", "created_at", "status", "first_name", "last_name", "email", "phone",
      "street", "city", "zip", "country", "delivery_method", "kit_price_czk",
      "total_price_czk", "locale", "accepted_at",
    ],
    order: "created_at",
  },
  newsletter: {
    table: "newsletter_subscribers",
    columns: ["email", "locale", "source", "consented_at", "unsubscribed_at", "created_at"],
    order: "created_at",
  },
  messages: {
    table: "contact_messages",
    columns: ["created_at", "name", "email", "message", "locale", "handled_at"],
    order: "created_at",
  },
  designs: {
    table: "designs",
    columns: ["slug", "locale", "source", "created_at"],
    order: "created_at",
  },
};

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function GET(req: Request) {
  const status = await backstageApiStatus();
  if (status) return NextResponse.json({ ok: false }, { status });

  const what = new URL(req.url).searchParams.get("what") ?? "";
  const spec = EXPORTS[what];
  if (!spec) {
    return NextResponse.json({ ok: false, error: "unknown_export" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(spec.table)
    .select(spec.columns.join(","))
    .order(spec.order, { ascending: false })
    .limit(10_000);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Row[];
  const csv = [
    spec.columns.join(","),
    ...rows.map((row) => spec.columns.map((c) => csvCell(row[c])).join(",")),
  ].join("\n");

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="myble-${what}-${stamp}.csv"`,
    },
  });
}
