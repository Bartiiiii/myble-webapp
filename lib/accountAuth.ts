import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { DEFAULT_LOCALE, localizePath, type Locale } from "./locale";

// ─────────────────────────────────────────────────────────────────────────────
// My Account auth — one gate: signed in with Google. Unlike backstage
// (lib/adminAuth.ts), there's no second cookie layer, since this isn't a
// privileged area, just "is someone logged in."
//
// email() lowercases/trims, matching the ADMIN_EMAIL / newsletter_subscribers
// convention elsewhere in this repo — every /api/account/* query filters on
// this normalized value, never on a client-supplied one.
// ─────────────────────────────────────────────────────────────────────────────

export interface AccountSession {
  email: string;
  name: string | null;
  image: string | null;
}

async function getAccountSession(): Promise<AccountSession | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase() ?? null;
  if (!email) return null;
  return { email, name: session?.user?.name ?? null, image: session?.user?.image ?? null };
}

/** Page guard: redirects to /login (with a callback back here) when signed out. */
export async function requireAccount(locale: Locale = DEFAULT_LOCALE, callbackPath = "/account"): Promise<AccountSession> {
  const session = await getAccountSession();
  if (!session) redirect(localizePath(`/login?callbackUrl=${encodeURIComponent(localizePath(callbackPath, locale))}`, locale));
  return session;
}

/** API guard: returns null when authorized, otherwise the HTTP status to send. */
export async function accountApiStatus(): Promise<{ status: number | null; email: string | null }> {
  const session = await getAccountSession();
  return { status: session ? null : 401, email: session?.email ?? null };
}
