"use client";

// First sign-in: confirm the name and avatar the community will see.
//
// Google hands us a name and photo, and we pre-fill both — but they are the
// suggestion, not the decision. Nobody's work photo ends up credited on a
// public design card without them having looked at it once.
//
// Reached automatically right after the first Google sign-in (see
// ProfileBootstrap in app/providers.tsx); `?next=` carries wherever the person
// was heading, so confirming drops them back there.

import { useSearchParams } from "next/navigation";
import { useLocaleRouter, useLocalizePath } from "../../../lib/localeNav";
import { useSession } from "next-auth/react";
import React, { Suspense, useEffect, useState } from "react";
import posthog from "posthog-js";
import { SiteHeader } from "../../../components/SiteHeader";
import { ProfileEditor, type ProfileDraft } from "../../../components/account/ProfileEditor";
import { useT } from "../../../lib/i18n";

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  );
}

function Welcome() {
  const t = useT();
  const router = useLocaleRouter();
  const lp = useLocalizePath();
  const { status } = useSession();

  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [googleImage, setGoogleImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // From the router rather than window.location: this page is reached by a
  // client-side push, and on that first render the address bar still shows the
  // page the person came from.
  const rawNext = useSearchParams().get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(lp(`/welcome?next=${encodeURIComponent(next)}`))}`);
      return;
    }
    if (status !== "authenticated") return;

    let cancelled = false;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body?.ok) return;
        setGoogleImage(body.googleImage ?? null);
        setDraft({
          displayName: body.profile.displayName ?? body.googleName ?? "",
          handle: body.profile.handle ?? "",
          avatarUrl: body.profile.avatarUrl ?? body.googleImage ?? null,
          avatarColor: body.profile.avatarColor ?? 0,
          bio: body.profile.bio ?? "",
        });
      })
      .catch(() => setError(t("profile.saveError")));
    return () => {
      cancelled = true;
    };
  }, [status, router, t, next, lp]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? "save_failed");
      posthog.capture("profile_confirmed", { handle: body.profile.handle });
      router.replace(next);
    } catch {
      setError(t("profile.saveError"));
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SiteHeader variant="app" />
      <main className="mx-auto w-full max-w-xl px-5 py-12">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{t("profile.welcomeTitle")}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{t("profile.welcomeBody")}</p>

        <div className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-zinc-200 sm:p-8">
          {draft ? (
            <ProfileEditor
              draft={draft}
              googleImage={googleImage}
              onChange={setDraft}
              onSubmit={save}
              saving={saving}
              error={error}
              submitLabel={t("profile.confirm")}
            />
          ) : (
            <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />
          )}
        </div>
      </main>
    </div>
  );
}
