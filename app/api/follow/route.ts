import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { accountApiStatus } from "@/lib/accountAuth";
import { ensureProfile, getProfileByHandle, setFollow } from "@/lib/community";

// POST { handle, on: boolean } → { ok, followers, following }
//
// Following requires a signed-in profile (created on the spot if this is the
// person's very first action). The target is looked up by handle, so the
// client never sends an id it could have guessed, and following yourself is
// rejected here as well as by a CHECK constraint in the table.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { status, email } = await accountApiStatus();
  if (status || !email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: status ?? 401 });

  let body: { handle?: unknown; on?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const handle = typeof body.handle === "string" ? body.handle.trim().toLowerCase() : "";
  const on = body.on === true;
  if (!handle) return NextResponse.json({ ok: false, error: "invalid_handle" }, { status: 400 });

  try {
    const target = await getProfileByHandle(handle);
    if (!target) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    const session = await getServerSession(authOptions);
    const me = await ensureProfile({
      email,
      name: session?.user?.name ?? null,
      image: session?.user?.image ?? null,
    });
    if (!me) return NextResponse.json({ ok: false, error: "no_profile" }, { status: 500 });
    if (me.id === target.id) return NextResponse.json({ ok: false, error: "self" }, { status: 400 });

    const followers = await setFollow(me.id, target.id, on);
    return NextResponse.json({ ok: true, followers, following: on });
  } catch (err) {
    console.error("[follow] threw", { err });
    return NextResponse.json({ ok: false, error: "follow_failed" }, { status: 500 });
  }
}
