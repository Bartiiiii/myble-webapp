import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { setNewsletterContactUnsubscribed } from "@/lib/newsletter";
import { getPostHogClient } from "@/lib/posthog-server";

// ─────────────────────────────────────────────────────────────────────────────
// One-click unsubscribe (GET so it works from an e-mail link, and POST for the
// RFC 8058 List-Unsubscribe-Post header). Looks the subscriber up by their
// per-row unsubscribe_token, stamps unsubscribed_at, mirrors the opt-out to
// Resend, and lands the visitor on /newsletter/unsubscribed. Idempotent; an
// unknown token shows the error variant without leaking which tokens exist.
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function unsubscribe(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const resultUrl = (status: "ok" | "invalid") =>
    new URL(`/newsletter/unsubscribed${status === "invalid" ? "?status=invalid" : ""}`, req.url);

  if (!UUID_RE.test(token)) return NextResponse.redirect(resultUrl("invalid"));

  try {
    const supabase = createAdminClient();
    const { data: row } = await supabase
      .from("newsletter_subscribers")
      .select("id, email, locale, unsubscribed_at")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (!row) return NextResponse.redirect(resultUrl("invalid"));

    if (!row.unsubscribed_at) {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) {
        console.error("[newsletter] unsubscribe persist failed", { error: error.message });
        return NextResponse.redirect(resultUrl("invalid"));
      }
      await Promise.all([
        setNewsletterContactUnsubscribed(row.email, true),
        getPostHogClient()
          .captureImmediate({
            distinctId: row.email,
            event: "newsletter_unsubscribed",
            properties: { locale: row.locale },
          })
          .catch((err) => console.error("[newsletter] posthog capture failed", { err })),
      ]);
    }
  } catch (err) {
    console.error("[newsletter] unsubscribe threw", { err });
    return NextResponse.redirect(resultUrl("invalid"));
  }

  return NextResponse.redirect(resultUrl("ok"));
}

export async function GET(req: Request) {
  return unsubscribe(req);
}

export async function POST(req: Request) {
  return unsubscribe(req);
}
