import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { accountApiStatus } from "@/lib/accountAuth";
import {
  sendNewsletterWelcomeEmail,
  setNewsletterContactUnsubscribed,
  syncNewsletterContact,
} from "@/lib/newsletter";
import { getPostHogClient } from "@/lib/posthog-server";

// ─────────────────────────────────────────────────────────────────────────────
// My Account → Settings newsletter toggle.
//
// Same `newsletter_subscribers` table and Resend mirroring as the footer/
// homepage capture in /api/newsletter, but its own small Supabase logic here
// rather than refactoring that route — it carries real consent/audit behaviour
// (source allowlist, IP capture for anonymous submissions) this shouldn't
// disturb. Source is recorded as "account" so the two entry points stay
// distinguishable in the data.
// ─────────────────────────────────────────────────────────────────────────────

function capture(event: string, email: string, properties: Record<string, unknown>) {
  return getPostHogClient()
    .captureImmediate({ distinctId: email, event, properties })
    .catch((err) => console.error("[account/newsletter] posthog capture failed", { err }));
}

export async function GET() {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("unsubscribed_at")
      .eq("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, subscribed: !!data && !data.unsubscribed_at });
  } catch (err) {
    console.error("[account/newsletter] read threw", { err });
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  let body: { subscribed?: boolean; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (typeof body?.subscribed !== "boolean") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const locale = body.locale === "en" ? "en" : "cs";

  try {
    const supabase = createAdminClient();
    const { data: existing, error: readError } = await supabase
      .from("newsletter_subscribers")
      .select("id, unsubscribed_at")
      .eq("email", email)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    if (body.subscribed) {
      if (!existing) {
        const { data: inserted, error } = await supabase
          .from("newsletter_subscribers")
          .insert({ email, locale, source: "account" })
          .select("id, unsubscribe_token")
          .single();
        if (error) throw new Error(error.message);
        const [contactId] = await Promise.all([
          syncNewsletterContact(email),
          sendNewsletterWelcomeEmail({ email, locale, unsubscribeToken: inserted.unsubscribe_token }),
          capture("newsletter_subscribed", email, { source: "account", locale }),
        ]);
        if (contactId) {
          await supabase.from("newsletter_subscribers").update({ resend_contact_id: contactId }).eq("id", inserted.id);
        }
      } else if (existing.unsubscribed_at) {
        const { error } = await supabase
          .from("newsletter_subscribers")
          .update({ unsubscribed_at: null, consented_at: new Date().toISOString(), source: "account" })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        await Promise.all([
          setNewsletterContactUnsubscribed(email, false),
          capture("newsletter_resubscribed", email, { source: "account", locale }),
        ]);
      }
      // Already subscribed: no-op, idempotent.
    } else if (existing && !existing.unsubscribed_at) {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      await Promise.all([
        setNewsletterContactUnsubscribed(email, true),
        capture("newsletter_unsubscribed", email, { source: "account", locale }),
      ]);
    }
    // No row and unsubscribing, or already unsubscribed: no-op, idempotent.

    return NextResponse.json({ ok: true, subscribed: body.subscribed });
  } catch (err) {
    console.error("[account/newsletter] write threw", { err });
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }
}
