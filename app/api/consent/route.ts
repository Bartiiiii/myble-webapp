import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Cookie-consent audit log (B6 — server-side proof of consent).
//
// The browser's `myble_consent` cookie drives the trackers; this route makes the
// decision DURABLE. Every accept / reject / customise / withdraw fires one POST,
// and we append an immutable row to `cookie_consents` (RLS deny-all, service-role
// write) with the anonymous consent id, the categories chosen, the schema +
// Cookies-Policy versions in force, and a light IP / user-agent trail — the
// Cookiebot-equivalent evidence a regulator would ask for.
//
// This is best-effort and fire-and-forget from the client: it must never block
// or break the consent UI. A failure here is logged, not surfaced.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = new Set(["accept_all", "reject_all", "save", "withdraw"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ConsentLogPayload {
  consentId?: string;
  analytics?: boolean;
  marketing?: boolean;
  action?: string;
  consentVersion?: number;
  policyVersion?: string;
  locale?: string;
}

export async function POST(req: Request) {
  let body: ConsentLogPayload;
  try {
    body = (await req.json()) as ConsentLogPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const consentId = typeof body.consentId === "string" ? body.consentId : "";
  if (!UUID_RE.test(consentId)) {
    return NextResponse.json({ ok: false, error: "invalid_consent_id" }, { status: 400 });
  }
  if (typeof body.analytics !== "boolean" || typeof body.marketing !== "boolean") {
    return NextResponse.json({ ok: false, error: "invalid_categories" }, { status: 400 });
  }
  const action = ACTIONS.has(body.action ?? "") ? (body.action as string) : "save";
  const consentVersion = Number.isInteger(body.consentVersion) ? (body.consentVersion as number) : 1;
  const policyVersion = typeof body.policyVersion === "string" ? body.policyVersion.slice(0, 20) : "";
  const locale = body.locale === "en" ? "en" : "cs";

  // Behind Vercel/proxies the client IP is the first entry of x-forwarded-for;
  // fall back to x-real-ip.
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent");

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("cookie_consents").insert({
      consent_id: consentId,
      analytics: body.analytics,
      marketing: body.marketing,
      action,
      consent_version: consentVersion,
      policy_version: policyVersion,
      locale,
      ip,
      user_agent: userAgent,
    });

    if (error) {
      console.error("[consent] persist failed", { error: error.message });
      return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
    }
  } catch (err) {
    console.error("[consent] persist threw", { err });
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
