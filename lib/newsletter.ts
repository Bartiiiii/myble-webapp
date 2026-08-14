import { Resend } from "resend";

// ─────────────────────────────────────────────────────────────────────────────
// Newsletter ↔ Resend integration.
//
// Supabase (`newsletter_subscribers`) stays the source of truth for consent;
// this module mirrors it into Resend so broadcasts can be sent from the Resend
// dashboard: a contact per subscriber (opted into the "Newsletter" topic) and
// a welcome e-mail with a one-click unsubscribe link.
//
// Every function is best-effort and never throws — a Resend hiccup must not
// break the signup itself (the Supabase row is what counts legally).
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL = "https://my-ble.eu";

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

const copy = {
  en: {
    subject: "Welcome to Myble — tips for awkward spaces",
    greeting: "Hi,",
    intro:
      "Thanks for subscribing. Every now and then we'll send you short e-mails on measuring tricky spots, materials, and new pieces. No spam.",
    cta: "Design your first piece",
    unsubscribe: "Unsubscribe",
    footer: "You're receiving this because you subscribed at my-ble.eu.",
  },
  cs: {
    subject: "Vítejte v Myble — tipy pro nešikovné prostory",
    greeting: "Dobrý den,",
    intro:
      "děkujeme za přihlášení. Občas vám pošleme krátký e-mail o měření nešikovných míst, materiálech a novinkách. Žádný spam.",
    cta: "Navrhnout první kus",
    unsubscribe: "Odhlásit odběr",
    footer: "Tento e-mail dostáváte, protože jste se přihlásili na my-ble.eu.",
  },
} as const;

export type NewsletterLocale = keyof typeof copy;

function unsubscribeUrl(token: string): string {
  return `${SITE_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

function buildWelcomeHtml(locale: NewsletterLocale, token: string): string {
  const t = copy[locale];
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b;">
      <p>${t.greeting}</p>
      <p>${t.intro}</p>
      <p style="margin-top:24px;">
        <a href="${SITE_URL}/design" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:12px;">${t.cta}</a>
      </p>
      <p style="margin-top:32px;font-size:12px;color:#a1a1aa;">
        ${t.footer}
        <a href="${unsubscribeUrl(token)}" style="color:#a1a1aa;">${t.unsubscribe}</a>
      </p>
    </div>
  `.trim();
}

/**
 * Creates (or reuses) the Resend contact for a subscriber and opts it into the
 * "Newsletter" topic. Returns the Resend contact id, or null on failure.
 */
export async function syncNewsletterContact(email: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const topicId = process.env.RESEND_NEWSLETTER_TOPIC_ID;
  try {
    const { data, error } = await client.contacts.create({
      email,
      unsubscribed: false,
      ...(topicId ? { topics: [{ id: topicId, subscription: "opt_in" as const }] } : {}),
    });
    if (error) {
      console.error("[newsletter] resend contact create failed", { error: error.message });
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error("[newsletter] resend contact create threw", { err });
    return null;
  }
}

/** Flips the Resend contact's global subscription state. */
export async function setNewsletterContactUnsubscribed(
  email: string,
  unsubscribed: boolean
): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    const { error } = await client.contacts.update({ email, unsubscribed });
    if (error) console.error("[newsletter] resend contact update failed", { error: error.message });
  } catch (err) {
    console.error("[newsletter] resend contact update threw", { err });
  }
}

/** Sends the welcome e-mail with the one-click unsubscribe link. */
export async function sendNewsletterWelcomeEmail(params: {
  email: string;
  locale: NewsletterLocale;
  unsubscribeToken: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const client = getClient();
  if (!client) return { sent: false, reason: "no_api_key" };

  const from = process.env.RESEND_FROM_EMAIL || "Myble <onboarding@resend.dev>";
  const url = unsubscribeUrl(params.unsubscribeToken);

  try {
    const { error } = await client.emails.send({
      from,
      to: params.email,
      subject: copy[params.locale].subject,
      html: buildWelcomeHtml(params.locale, params.unsubscribeToken),
      headers: {
        "List-Unsubscribe": `<${url}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (error) {
      console.error("[newsletter] welcome send failed", { error: error.message });
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error("[newsletter] welcome send threw", { err });
    return { sent: false, reason: "exception" };
  }
}
