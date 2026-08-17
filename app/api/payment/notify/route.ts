import { NextResponse } from "next/server";
import { logPaymentEvent, syncPaymentByTransId, verifyPushSecret } from "@/lib/payments";
import type { ComgatePushPayload } from "@/lib/comgate/types";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/notify   ← Comgate's url_push endpoint
//
// Configure this URL at portal.comgate.cz (Integration → Notification URL), or
// via the /config.json API endpoint. It MUST be https.
//
// THE THREE RULES OF THIS HANDLER
//
//   1. The payload is NOT trusted. Comgate does not sign push notifications —
//      it echoes the shared API secret instead. We check that secret in constant
//      time, then discard the body and ask the status API what really happened.
//
//   2. Return 2xx or Comgate retries. Comgate resends up to 1 000 times and then
//      emails you. That retry loop is a feature: if our database is down we
//      WANT the redelivery. So we return 500 on genuine internal failure and
//      2xx once the event is durably handled.
//
//   3. Idempotency lives in syncPaymentByTransId(), not here. This route may be
//      invoked many times for the same transaction — by design.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Comgate sends JSON for v2.0 payments and form-encoded for v1.0. Accept both. */
async function parsePayload(req: Request): Promise<ComgatePushPayload> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await req.json()) as ComgatePushPayload;
  }
  const text = await req.text();
  const params = new URLSearchParams(text);
  return Object.fromEntries(params.entries()) as ComgatePushPayload;
}

export async function POST(req: Request) {
  const sourceIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  let payload: ComgatePushPayload;
  try {
    payload = await parsePayload(req);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // ── Authentication ────────────────────────────────────────────────────────
  if (!verifyPushSecret(typeof payload.secret === "string" ? payload.secret : undefined)) {
    await logPaymentEvent({
      kind: "error",
      transId: typeof payload.transId === "string" ? payload.transId : null,
      orderNo: typeof payload.refId === "string" ? payload.refId : null,
      message: "push notification rejected: bad or missing secret",
      payload: { ...payload, secret: "[redacted]" },
      sourceIp,
    });
    // 403 and not 2xx: a forged request should not be acknowledged.
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const transId = typeof payload.transId === "string" ? payload.transId : null;
  if (!transId) {
    // Nothing to reconcile — acknowledge so Comgate stops retrying a useless body.
    await logPaymentEvent({
      kind: "push",
      message: "push notification without transId",
      payload: { ...payload, secret: "[redacted]" },
      sourceIp,
    });
    return new NextResponse("OK", { status: 200 });
  }

  try {
    const { changed, newlyPaid, payment } = await syncPaymentByTransId(transId, "push", sourceIp);

    if (newlyPaid) {
      // Fulfilment side effects belong HERE, guarded by `newlyPaid`, so they run
      // exactly once no matter how many times Comgate redelivers.
      //
      // TODO(Barti): send the paid-order confirmation email. Deliberately not
      // wired yet — /api/order already sends the order-received email, and the
      // paid email needs its own template (see lib/email.ts).
      console.info("[payment/notify] payment captured", {
        orderNo: payment.order_no,
        method: payment.method,
        amountCzk: payment.amount_minor / 100,
      });
    }

    return new NextResponse(changed ? "OK" : "OK (no change)", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[payment/notify] sync failed", { transId, message });
    await logPaymentEvent({
      transId,
      kind: "error",
      message: `push sync failed: ${message}`,
      payload: { ...payload, secret: "[redacted]" },
      sourceIp,
    });
    // 500 → Comgate retries. That is what we want for a transient failure.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/** Some Comgate configurations probe the URL with GET. Answer politely. */
export async function GET() {
  return new NextResponse("OK", { status: 200 });
}
