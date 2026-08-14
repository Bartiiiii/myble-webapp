import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  sendNewsletterWelcomeEmail,
  setNewsletterContactUnsubscribed,
  syncNewsletterContact,
} from "@/lib/newsletter";
import { getPostHogClient } from "@/lib/posthog-server";

// ─────────────────────────────────────────────────────────────────────────────
// Newsletter signup (footer + homepage e-mail capture).
//
// Supabase (`newsletter_subscribers`, RLS deny-all, service-role writes) is the
// consent record; Resend mirrors it for sending. On a NEW subscription we also
// create the Resend contact (opted into the "Newsletter" topic), send the
// welcome e-mail with the one-click unsubscribe link, and capture a PostHog
// event. Re-subscribing an existing address is a silent success (idempotent,
// doesn't leak list membership) — unless it had unsubscribed, in which case we
// re-activate it. Resend/PostHog failures never fail the request: the Supabase
// row is what counts.
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SOURCES = new Set(["footer", "homepage"]);

function capture(event: string, email: string, properties: Record<string, unknown>) {
  return getPostHogClient()
    .captureImmediate({ distinctId: email, event, properties })
    .catch((err) => console.error("[newsletter] posthog capture failed", { err }));
}

export async function POST(req: Request) {
  let body: { email?: string; locale?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const email = body?.email?.trim().toLowerCase() ?? "";
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  const locale = body?.locale === "en" ? "en" : "cs";
  const source = SOURCES.has(body?.source ?? "") ? (body!.source as string) : "footer";

  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;

  try {
    const supabase = createAdminClient();
    // ignoreDuplicates + select: returns the row only when it was inserted,
    // so an empty result means the address was already on the list.
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .upsert(
        { email, locale, source, ip, user_agent: req.headers.get("user-agent") },
        { onConflict: "email", ignoreDuplicates: true },
      )
      .select("id, unsubscribe_token");

    if (error) {
      console.error("[newsletter] persist failed", { error: error.message });
      return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
    }

    const inserted = data?.[0];
    if (inserted) {
      // New subscriber: mirror into Resend, welcome them, count it.
      const [contactId] = await Promise.all([
        syncNewsletterContact(email),
        sendNewsletterWelcomeEmail({ email, locale, unsubscribeToken: inserted.unsubscribe_token }),
        capture("newsletter_subscribed", email, { source, locale }),
      ]);
      if (contactId) {
        await supabase
          .from("newsletter_subscribers")
          .update({ resend_contact_id: contactId })
          .eq("id", inserted.id);
      }
    } else {
      // Existing address — if it had unsubscribed, this is an explicit re-opt-in.
      const { data: existing } = await supabase
        .from("newsletter_subscribers")
        .select("id, unsubscribed_at")
        .eq("email", email)
        .maybeSingle();
      if (existing?.unsubscribed_at) {
        await supabase
          .from("newsletter_subscribers")
          .update({ unsubscribed_at: null, consented_at: new Date().toISOString(), source })
          .eq("id", existing.id);
        await Promise.all([
          setNewsletterContactUnsubscribed(email, false),
          capture("newsletter_resubscribed", email, { source, locale }),
        ]);
      }
    }
  } catch (err) {
    console.error("[newsletter] persist threw", { err });
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
