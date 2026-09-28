"use client";

// A designer's profile: who they are, how many people follow them, and every
// design of theirs that is live in the library.
//
// Client-rendered like the rest of the public site (lib/i18n is client-only),
// reading /api/profiles/<handle>, which decides what is public: published
// designs only, never someone's private or pending work.

import Link, { useLocalizePath } from "../../../../lib/localeNav";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import posthog from "posthog-js";
import { SiteHeader } from "../../../../components/SiteHeader";
import { SiteFooter } from "../../../../components/SiteFooter";
import { Reveal } from "../../../../components/Reveal";
import { Avatar } from "../../../../components/Avatar";
import { DesignCard } from "../../../../components/library/DesignCard";
import { DesignDialog } from "../../../../components/library/DesignDialog";
import { ReactionsProvider } from "../../../../lib/reactions";
import type { LibraryItem } from "../../../../lib/library";
import type { Author } from "../../../../lib/designers";
import { useI18n } from "../../../../lib/i18n";

interface ProfilePayload {
  profile: Author & { bio: string | null; joinedAt: string };
  followers: number;
  following: number;
  isFollowing: boolean;
  isSelf: boolean;
  signedIn: boolean;
  items: LibraryItem[];
}

export default function ProfilePage() {
  const { t } = useI18n();
  const params = useParams<{ handle: string }>();
  const handle = typeof params?.handle === "string" ? params.handle : "";

  const [data, setData] = useState<ProfilePayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [detail, setDetail] = useState<LibraryItem | null>(null);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    fetch(`/api/profiles/${encodeURIComponent(handle)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        if (body?.ok) {
          setData(body as ProfilePayload);
          setState("ready");
        } else {
          setState("missing");
        }
      })
      .catch(() => !cancelled && setState("missing"));
    return () => {
      cancelled = true;
    };
  }, [handle]);

  // Optimistic follow, reconciled with the count the server returns.
  const [busy, setBusy] = useState(false);
  const toggleFollow = useCallback(async () => {
    if (!data || busy) return;
    const on = !data.isFollowing;
    setBusy(true);
    setData((prev) =>
      prev ? { ...prev, isFollowing: on, followers: Math.max(0, prev.followers + (on ? 1 : -1)) } : prev,
    );
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, on }),
      });
      const body = await res.json();
      if (body?.ok) {
        posthog.capture(on ? "designer_followed" : "designer_unfollowed", { handle });
        setData((prev) => (prev ? { ...prev, isFollowing: body.following, followers: body.followers } : prev));
      }
    } catch {
      /* leave the optimistic state; a reload re-reads the truth */
    } finally {
      setBusy(false);
    }
  }, [busy, data, handle]);

  return (
    <ReactionsProvider>
      <div className="min-h-screen bg-white text-zinc-900">
        <SiteHeader />

        {state === "missing" ? (
          <section className="mx-auto w-full max-w-6xl px-5 py-24 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{t("profile.missing")}</h1>
            <Link href="/library" className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500">
              {t("profile.backToLibrary")}
            </Link>
          </section>
        ) : state === "loading" || !data ? (
          <section className="mx-auto w-full max-w-6xl px-5 py-24">
            <div className="h-20 w-20 animate-pulse rounded-full bg-zinc-100" />
          </section>
        ) : (
          <>
            {/* Header */}
            <section className="mx-auto w-full max-w-6xl px-5 pb-6 pt-12 sm:pt-16">
              <Reveal>
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <Avatar person={data.profile} size="xl" />
                    <div className="min-w-0">
                      <h1 className="truncate text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                        {data.profile.name}
                      </h1>
                      <p className="mt-1 font-mono text-xs text-zinc-400">@{data.profile.handle}</p>
                      {data.profile.bio && (
                        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">{data.profile.bio}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <Stat n={data.items.length} label={t("profile.designs")} />
                    <Stat n={data.followers} label={t("profile.followers")} />
                    <FollowButton
                      isSelf={data.isSelf}
                      signedIn={data.signedIn}
                      following={data.isFollowing}
                      busy={busy}
                      onToggle={toggleFollow}
                      handle={handle}
                    />
                  </div>
                </div>
              </Reveal>
            </section>

            {/* Their designs */}
            <section className="mx-auto w-full max-w-6xl px-5 py-8">
              {data.items.length === 0 ? (
                <p className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                  {t("profile.noDesigns")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
                  {data.items.map((item, i) => (
                    <DesignCard
                      key={item.id}
                      item={item}
                      index={i}
                      onDetails={setDetail}
                      showAuthor={false}
                      from="profile"
                    />
                  ))}
                </div>
              )}
            </section>

            <DesignDialog item={detail} onClose={() => setDetail(null)} from="profile" />
          </>
        )}

        <SiteFooter />
      </div>
    </ReactionsProvider>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{n}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}

function FollowButton({
  isSelf,
  signedIn,
  following,
  busy,
  onToggle,
  handle,
}: {
  isSelf: boolean;
  signedIn: boolean;
  following: boolean;
  busy: boolean;
  onToggle: () => void;
  handle: string;
}) {
  const { t } = useI18n();
  const lp = useLocalizePath();

  if (isSelf) {
    return (
      <Link
        href="/account/settings"
        className="press inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
      >
        {t("profile.editProfile")}
      </Link>
    );
  }

  // Signed out: send them to log in and come straight back here, rather than
  // failing the follow with a 401 they cannot act on.
  if (!signedIn) {
    return (
      <Link
        href={`/login?callbackUrl=${encodeURIComponent(lp(`/u/${handle}`))}`}
        className="press inline-flex items-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
      >
        {t("profile.follow")}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={following}
      className={`press inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
        following
          ? "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
          : "bg-zinc-900 text-white hover:bg-zinc-800"
      }`}
    >
      {following ? t("profile.following") : t("profile.follow")}
    </button>
  );
}
