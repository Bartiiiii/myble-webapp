import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getTransfer, listTransfers } from "@/lib/comgate/client";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cron/comgate-settlements?date=YYYY-MM-DD
//
// Daily reconciliation: pull Comgate's payouts and match them to our payments.
// This is what turns "the gateway says I earned X" into "X arrived in the bank
// account, and here are the orders it covers" — i.e. accounting-ready data.
//
// Schedule in vercel.json:
//   { "crons": [{ "path": "/api/cron/comgate-settlements", "schedule": "0 6 * * *" }] }
//
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Set CRON_SECRET in the
// project env; without it this route refuses to run in production.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Yesterday in YYYY-MM-DD — payouts settle D+1, so that is the useful default. */
function defaultDate(): string {
  const d = new Date(Date.now() - 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const date = new URL(req.url).searchParams.get("date") ?? defaultDate();
  const supabase = createAdminClient();

  let transfers;
  try {
    transfers = await listTransfers(date);
  } catch (err) {
    console.error("[cron/settlements] listTransfers failed", { date, err });
    return NextResponse.json({ ok: false, error: "list_failed", date }, { status: 502 });
  }

  let stored = 0;
  let matchedPayments = 0;

  for (const transfer of transfers) {
    const transferId = String(transfer.transferId);
    let detail: Record<string, unknown> = {};
    try {
      detail = (await getTransfer(transferId)) as unknown as Record<string, unknown>;
    } catch (err) {
      console.warn("[cron/settlements] getTransfer failed", { transferId, err });
    }

    const { error } = await supabase.from("payment_settlements").upsert(
      {
        transfer_id: transferId,
        transfer_date: transfer.transferDate ?? date,
        account: transfer.accountOutgoing ?? transfer.accountCounterparty ?? null,
        variable_symbol: transfer.variableSymbol ?? null,
        detail,
      },
      { onConflict: "transfer_id" },
    );
    if (!error) stored += 1;

    // Match by variable symbol where Comgate provides one. Payments carry the
    // VS returned on their status call, so this is a direct join.
    if (transfer.variableSymbol) {
      const { data: matched } = await supabase
        .from("payments")
        .update({ settled_transfer_id: transferId, settled_at: new Date().toISOString() })
        .eq("variable_symbol", transfer.variableSymbol)
        .eq("status", "paid")
        .is("settled_transfer_id", null)
        .select("id, amount_minor");

      const rows = (matched ?? []) as { id: string; amount_minor: number }[];
      if (rows.length) {
        matchedPayments += rows.length;
        await supabase
          .from("payment_settlements")
          .update({
            matched_count: rows.length,
            matched_minor: rows.reduce((s, r) => s + r.amount_minor, 0),
          })
          .eq("transfer_id", transferId);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date,
    transfers: transfers.length,
    stored,
    matchedPayments,
  });
}
