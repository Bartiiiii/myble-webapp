import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { LIBRARY_IDS } from "@/lib/library";
import { publishedSlugs } from "@/lib/community";

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 reactions on Design Library pieces.
//
// GET                    → { ok, counts: { [designId]: number }, mine: string[] }
// POST { id, on: bool }  → { ok, count, on }
//
// ONE 🔥 PER PERSON, enforced by the database, not by the browser.
//
// The old version took a client-supplied ±1 and added it to a counter, with
// localStorage as the only record of who had already reacted — so clearing
// storage, opening a second browser, or simply posting {delta: 1} in a loop
// drove the number up forever. Now every 🔥 is a ROW keyed
// (design_id, reactor_key) with that pair as the primary key: the request says
// "this person is on/off for this design", never "add one", and the count is
// count(*) over those rows. Repeating a request is a no-op, so spamming the
// button (or the endpoint) cannot move the number past 1 per person.
//
// Who "this person" is:
//   • signed in  → 'u:<e-mail>' from the session — same on every device.
//   • otherwise  → 'a:<uuid>' from an httpOnly cookie we set here. Being
//     httpOnly, page JS can neither read nor clear it, unlike the localStorage
//     marker it replaces.
//
// Ids are validated against the curated library plus the slugs backstage has
// published, so no arbitrary row can be created.
//
// Fail-soft: if the tables/functions aren't migrated yet (0007_community.sql),
// GET returns empty state and POST reports ok:false, and the UI degrades to
// showing zero rather than breaking the page.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "myble_vid";
const CURATED = new Set(LIBRARY_IDS);

/** The stable identity of whoever is reacting, plus a cookie to set if new. */
async function reactor(): Promise<{ key: string; setCookie: string | null }> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (email) return { key: `u:${email}`, setCookie: null };

  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return { key: `a:${existing}`, setCookie: null };

  const fresh = randomUUID();
  return { key: `a:${fresh}`, setCookie: fresh };
}

function withCookie(res: NextResponse, value: string | null): NextResponse {
  if (value) {
    res.cookies.set(VISITOR_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

async function isAllowed(id: string): Promise<boolean> {
  if (CURATED.has(id)) return true;
  return (await publishedSlugs()).has(id);
}

export async function GET() {
  const { key, setCookie } = await reactor();

  try {
    const supabase = createAdminClient();
    const [{ data: counts, error: countsErr }, { data: mine, error: mineErr }] = await Promise.all([
      supabase.rpc("design_fire_counts"),
      supabase.from("design_fires").select("design_id").eq("reactor_key", key),
    ]);

    if (countsErr) {
      console.error("[reactions] counts failed", { error: countsErr.message });
      return withCookie(NextResponse.json({ ok: false, counts: {}, mine: [] }), setCookie);
    }

    const out: Record<string, number> = {};
    for (const row of (counts ?? []) as { design_id: string; fire_count: number }[]) {
      out[row.design_id] = row.fire_count;
    }
    const mineIds = mineErr ? [] : ((mine ?? []) as { design_id: string }[]).map((r) => r.design_id);

    return withCookie(NextResponse.json({ ok: true, counts: out, mine: mineIds }), setCookie);
  } catch (err) {
    console.error("[reactions] read threw", { err });
    return withCookie(NextResponse.json({ ok: false, counts: {}, mine: [] }), setCookie);
  }
}

export async function POST(req: Request) {
  let body: { id?: unknown; on?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id || !(await isAllowed(id))) {
    return NextResponse.json({ ok: false, error: "unknown_design" }, { status: 400 });
  }
  // A state, not a delta: "I am on/off for this design".
  const on = body.on === true;

  const { key, setCookie } = await reactor();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("set_design_fire", {
      p_design_id: id,
      p_reactor_key: key,
      p_on: on,
    });

    if (error) {
      console.error("[reactions] set failed", { id, on, error: error.message });
      return NextResponse.json({ ok: false, error: "set_failed" }, { status: 500 });
    }
    return withCookie(
      NextResponse.json({ ok: true, on, count: typeof data === "number" ? data : 0 }),
      setCookie,
    );
  } catch (err) {
    console.error("[reactions] set threw", { id, on, err });
    return NextResponse.json({ ok: false, error: "set_failed" }, { status: 500 });
  }
}
