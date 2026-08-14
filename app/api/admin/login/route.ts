import { NextResponse } from "next/server";
import {
  BACKSTAGE_COOKIE,
  getBackstageGate,
  mintSessionToken,
  verifyAdminCredentials,
} from "@/lib/adminAuth";

// In-memory throttle: 5 failed attempts per IP per 15 minutes. Resets on
// deploy/restart, which is fine — it only needs to blunt brute force.
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; windowStart: number }>();

function isThrottled(ip: string): boolean {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip: string) {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.windowStart > WINDOW_MS) {
    failures.set(ip, { count: 1, windowStart: Date.now() });
  } else {
    entry.count += 1;
  }
}

export async function POST(req: Request) {
  // Gate 1: only the owner's Google session may even attempt the password.
  const gate = await getBackstageGate();
  if (!gate.googleOk) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  if (isThrottled(ip)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
  }

  let body: { login?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.login || !body.password || !verifyAdminCredentials(body.login, body.password)) {
    recordFailure(ip);
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  failures.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(BACKSTAGE_COOKIE, mintSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 3600,
  });
  return res;
}
