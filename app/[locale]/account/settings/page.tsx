"use client";

import React from "react";
import Link from "../../../../lib/localeNav";
import { useSession } from "next-auth/react";
import { useT } from "../../../../lib/i18n";
import { Avatar } from "../../../../components/Avatar";
import { LanguageSwitcher } from "../../../../components/LanguageSwitcher";
import { NewsletterToggle } from "../../../../components/account/NewsletterToggle";
import { ProfileEditor, type ProfileDraft } from "../../../../components/account/ProfileEditor";
import { Section } from "../../../../components/account/ui";

export default function AccountSettings() {
  const t = useT();
  const { data: session } = useSession();
  const user = session?.user;

  // The public half of the account: the name, handle and avatar that appear on
  // every design this person shares.
  //
  // It READS as a profile and only becomes a form when asked. A settings page
  // that opens with four focused-looking input boxes reads as unfinished work
  // waiting to be filled in, when in fact everything is already set. So the
  // default is what other people see, plus one quiet Edit button.
  const [saved, setSavedProfile] = React.useState<ProfileDraft | null>(null);
  const [draft, setDraft] = React.useState<ProfileDraft | null>(null);
  const [googleImage, setGoogleImage] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body?.ok) return;
        setGoogleImage(body.googleImage ?? null);
        setSavedProfile({
          displayName: body.profile.displayName ?? "",
          handle: body.profile.handle ?? "",
          avatarUrl: body.profile.avatarUrl ?? null,
          avatarColor: body.profile.avatarColor ?? 0,
          bio: body.profile.bio ?? "",
        });
      })
      .catch(() => {
        /* leave the panel empty rather than showing a half-loaded profile */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function startEditing() {
    setDraft(saved);
    setEditing(true);
    setJustSaved(false);
    setError(null);
  }

  function cancelEditing() {
    // A photo uploaded during the edit is already stored server-side, so the
    // saved profile keeps it; only the text fields are discarded.
    setDraft(null);
    setEditing(false);
    setError(null);
  }

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
      if (!res.ok || !body?.ok) throw new Error("save_failed");
      setSavedProfile({
        displayName: body.profile.displayName ?? "",
        handle: body.profile.handle ?? "",
        avatarUrl: body.profile.avatarUrl ?? null,
        avatarColor: body.profile.avatarColor ?? 0,
        bio: body.profile.bio ?? "",
      });
      setDraft(null);
      setEditing(false);
      setJustSaved(true);
    } catch {
      setError(t("profile.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("account.settings.title")}</h1>

      <Section title={t("account.settings.profileTitle")}>
        {!saved ? (
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
        ) : editing && draft ? (
          <ProfileEditor
            draft={draft}
            googleImage={googleImage}
            onChange={setDraft}
            onSubmit={save}
            onCancel={cancelEditing}
            saving={saving}
            error={error}
            submitLabel={t("profile.save")}
          />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar
                person={{
                  name: saved.displayName,
                  handle: saved.handle,
                  avatarUrl: saved.avatarUrl,
                  avatarColor: saved.avatarColor,
                }}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900">{saved.displayName || "—"}</p>
                <p className="truncate font-mono text-xs text-zinc-400">/u/{saved.handle}</p>
                <p className="truncate text-sm text-zinc-500">{user?.email ?? "—"}</p>
              </div>
            </div>

            {saved.bio && <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-600">{saved.bio}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startEditing}
                className="press inline-flex items-center justify-center rounded-xl bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
              >
                {t("profile.editProfile")}
              </button>
              {saved.handle && (
                <Link
                  href={`/u/${saved.handle}`}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  {t("profile.viewPublic")}
                </Link>
              )}
              {justSaved && <span className="text-xs font-medium text-emerald-600">{t("profile.saved")}</span>}
            </div>
          </>
        )}
      </Section>

      <Section title={t("account.settings.languageTitle")}>
        <LanguageSwitcher />
      </Section>

      <Section title={t("account.settings.newsletterTitle")}>
        <NewsletterToggle />
      </Section>
    </div>
  );
}
