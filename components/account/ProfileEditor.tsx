"use client";

import React from "react";
import { Avatar } from "../Avatar";
import { useT } from "../../lib/i18n";

// The name and face other people see: used both on first sign-in (/welcome)
// and later from My Account → Settings.
//
// Google gives us a name and a photo, and that photo is the default — most
// people are done the moment the page loads. The only two other options are
// the two that actually matter on a phone: pick a picture from the device, or
// take one. The eight tinted initials avatars this used to offer were a
// decision nobody asked to make; initials are still the fallback when there is
// no photo at all, they just aren't a menu any more.
//
// Photos are cropped square and resized to 256 px HERE, before upload, so what
// leaves the device is ~30 KB instead of a 4 MB camera original.

const AVATAR_PX = 256;

export interface ProfileDraft {
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  avatarColor: number;
  bio: string;
}

/** Centre-crops to a square and scales to AVATAR_PX, as a JPEG blob. */
async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_PX,
    AVATAR_PX,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("no_blob");
  return blob;
}

export function ProfileEditor({
  draft,
  googleImage,
  onChange,
  onSubmit,
  onCancel,
  saving,
  error,
  submitLabel,
}: {
  draft: ProfileDraft;
  googleImage: string | null;
  onChange: (next: ProfileDraft) => void;
  onSubmit: () => void;
  /** Shown as a secondary button when there is somewhere to go back to. */
  onCancel?: () => void;
  saving: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const t = useT();
  const pickRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const set = (patch: Partial<ProfileDraft>) => onChange({ ...draft, ...patch });
  const nameOk = draft.displayName.trim().length >= 2;

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const blob = await squareJpeg(file);
      const form = new FormData();
      form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok || !body?.ok) throw new Error("upload_failed");
      set({ avatarUrl: body.avatarUrl as string });
    } catch {
      setUploadError(t("profile.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (nameOk && !saving) onSubmit();
      }}
      className="space-y-6"
    >
      {/* Avatar */}
      <div className="flex flex-wrap items-center gap-5">
        <Avatar
          person={{
            name: draft.displayName || "?",
            handle: draft.handle,
            avatarUrl: draft.avatarUrl,
            avatarColor: draft.avatarColor,
          }}
          size="xl"
          className={uploading ? "opacity-50" : ""}
        />

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={pickRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {/* `capture` opens the camera directly on a phone; on a desktop
              browser it is ignored and this behaves like the picker above. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => pickRef.current?.click()}
            disabled={uploading}
            className="press rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            {uploading ? t("profile.uploading") : t("profile.uploadPhoto")}
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="press rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            {t("profile.takePhoto")}
          </button>

          {googleImage && draft.avatarUrl !== googleImage && (
            <button
              type="button"
              onClick={() => set({ avatarUrl: googleImage })}
              disabled={uploading}
              className="press text-xs font-medium text-zinc-500 underline-offset-2 transition hover:text-zinc-900 hover:underline disabled:opacity-60"
            >
              {t("profile.useGooglePhoto")}
            </button>
          )}
          {draft.avatarUrl && (
            <button
              type="button"
              onClick={() => set({ avatarUrl: null })}
              disabled={uploading}
              className="press text-xs font-medium text-zinc-500 underline-offset-2 transition hover:text-zinc-900 hover:underline disabled:opacity-60"
            >
              {t("profile.removePhoto")}
            </button>
          )}
        </div>
      </div>
      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

      {/* Name */}
      <div>
        <label htmlFor="displayName" className="text-sm font-medium text-zinc-900">
          {t("profile.nameLabel")}
        </label>
        <input
          id="displayName"
          value={draft.displayName}
          onChange={(e) => set({ displayName: e.target.value })}
          maxLength={40}
          className="mt-2 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-zinc-500">{t("profile.nameHint")}</p>
      </div>

      {/* Handle */}
      <div>
        <label htmlFor="handle" className="text-sm font-medium text-zinc-900">
          {t("profile.handleLabel")}
        </label>
        <div className="mt-2 flex items-center rounded-xl border border-zinc-300 focus-within:border-indigo-500">
          <span className="pl-3.5 font-mono text-sm text-zinc-400">/u/</span>
          <input
            id="handle"
            value={draft.handle}
            onChange={(e) => set({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
            maxLength={24}
            className="w-full rounded-r-xl bg-transparent px-1.5 py-2.5 font-mono text-sm text-zinc-900 focus:outline-none"
          />
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">{t("profile.handleHint")}</p>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className="text-sm font-medium text-zinc-900">
          {t("profile.bioLabel")}
        </label>
        <textarea
          id="bio"
          value={draft.bio}
          onChange={(e) => set({ bio: e.target.value })}
          maxLength={160}
          rows={2}
          className="mt-2 w-full resize-none rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!nameOk || saving || uploading}
          className="press inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {saving ? t("profile.saving") : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="press inline-flex items-center justify-center rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {t("profile.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
