import { NextResponse } from "next/server";
import { BACKSTAGE_COOKIE } from "@/lib/adminAuth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(BACKSTAGE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
