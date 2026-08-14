import { createHmac, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Backstage auth — two gates, both required:
//   1. Google gate: the NextAuth session e-mail must equal ADMIN_EMAIL. Anyone
//      else gets a plain 404, so /admin is invisible to the world.
//   2. Backstage gate: a valid `myble_backstage` cookie minted by the login
//      route after checking ADMIN_LOGIN + ADMIN_PASSWORD_HASH (scrypt).
// The cookie is a stateless HMAC token signed with AUTH_SECRET; rotating the
// secret invalidates every session.
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "bartek.kwasnica.2005@gmail.com").toLowerCase();

export const BACKSTAGE_COOKIE = "myble_backstage";
const SESSION_HOURS = 12;

function signingSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set — cannot sign backstage sessions");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function mintSessionToken(now = Date.now()): string {
  const exp = now + SESSION_HOURS * 3_600_000;
  return `${exp}.${sign(`backstage.${exp}`)}`;
}

export function isValidSessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < now || !sig) return false;
  const expected = Buffer.from(sign(`backstage.${exp}`));
  const actual = Buffer.from(sig);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyAdminCredentials(login: string, password: string): boolean {
  const expectedLogin = process.env.ADMIN_LOGIN ?? "admin";
  const stored = process.env.ADMIN_PASSWORD_HASH; // "scrypt:<salt b64>:<digest b64>"
  if (!stored) return false;
  const [scheme, saltB64, digestB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !digestB64) return false;

  const expectedDigest = Buffer.from(digestB64, "base64");
  const actualDigest = scryptSync(password, Buffer.from(saltB64, "base64"), expectedDigest.length);

  const loginA = Buffer.from(login);
  const loginB = Buffer.from(expectedLogin);
  const loginOk = loginA.length === loginB.length && timingSafeEqual(loginA, loginB);
  return loginOk && timingSafeEqual(actualDigest, expectedDigest);
}

export interface BackstageGate {
  /** Signed in with Google as the admin e-mail. */
  googleOk: boolean;
  /** googleOk AND holds a valid backstage session cookie. */
  backstageOk: boolean;
  email: string | null;
}

export async function getBackstageGate(): Promise<BackstageGate> {
  // Local-development escape hatch for previewing the backstage UI without a
  // Google session. Requires BOTH a dev build (never set on Vercel prod) and an
  // explicit opt-in via .env.development.local — absent by default.
  if (process.env.NODE_ENV === "development" && process.env.BACKSTAGE_DEV_PREVIEW === "1") {
    return { googleOk: true, backstageOk: true, email: ADMIN_EMAIL };
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  const googleOk = email !== null && email === ADMIN_EMAIL;
  let backstageOk = false;
  if (googleOk) {
    const store = await cookies();
    backstageOk = isValidSessionToken(store.get(BACKSTAGE_COOKIE)?.value);
  }
  return { googleOk, backstageOk, email };
}

/** Page guard: 404 for strangers, /admin/login for the owner without a session. */
export async function requireBackstage(): Promise<BackstageGate> {
  const gate = await getBackstageGate();
  if (!gate.googleOk) notFound();
  if (!gate.backstageOk) redirect("/admin/login");
  return gate;
}

/** API guard: returns null when authorized, otherwise an HTTP status to send. */
export async function backstageApiStatus(): Promise<number | null> {
  const gate = await getBackstageGate();
  if (!gate.googleOk) return 404;
  if (!gate.backstageOk) return 401;
  return null;
}
