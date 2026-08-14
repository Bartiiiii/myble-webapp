import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Contact form intake (/contact).
//
// Persists to `contact_messages` (RLS deny-all, service-role writes) so
// messages have a durable record with a handled_at follow-up marker — the
// mailto link on the page remains as a fallback.
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let body: { name?: string; email?: string; message?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const name = body?.name?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const message = body?.message?.trim() ?? "";

  if (!name || name.length > 200) {
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (!message || message.length > 5000) {
    return NextResponse.json({ ok: false, error: "invalid_message" }, { status: 400 });
  }
  const locale = body?.locale === "en" ? "en" : "cs";

  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      message,
      locale,
      ip,
      user_agent: req.headers.get("user-agent"),
    });

    if (error) {
      console.error("[contact] persist failed", { error: error.message });
      return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
    }
  } catch (err) {
    console.error("[contact] persist threw", { err });
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
