"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import type { RootState } from "@react-three/fiber";
import posthog from "posthog-js";
import type { Design } from "../../lib/model";
import { CATEGORIES, type ItemCategory } from "../../lib/library";
import { useI18n } from "../../lib/i18n";
import { renderClip, renderPicture } from "../../lib/shareMedia";

const ShelfViewer = dynamic(() => import("../ShelfViewer"), { ssr: false });

const WALL = "#ece7df";

// ─────────────────────────────────────────────────────────────────────────────
// "Share" in the configurator, which is really two different intentions:
//
//   • show it to somebody — a picture or a short spinning clip to drop into a
//     chat, a story, or AirDrop, plus the plain link;
//   • give it to the community — submit it to the Design Library, where it
//     waits for approval before it goes live.
//
// So the button opens a chooser rather than silently doing one of them (it
// used to copy a link and nothing else).
//
// The media half renders through the stage's own WebGL renderer at export size
// (lib/shareMedia.ts): a 1080 × 1920 PNG, and a 9:16 MP4 of one full turn,
// encoded to H.264 so it plays on anything. The stage is portrait too, so the
// preview is the crop you get. On a phone or tablet the file then goes through
// navigator.share (AirDrop, WhatsApp, Messages, Save to Photos); on a computer
// it is simply downloaded, since a desktop share sheet can't save it.
// ─────────────────────────────────────────────────────────────────────────────

type Panel = "choose" | "media" | "community";
type Busy = null | "image" | "video" | "link" | "submit";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick — Safari needs the URL to survive the click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Phones and tablets get the share sheet: on an iPhone it is also where "Save
 * Video" / "Save Image" live, and it reaches the messengers directly. A
 * computer gets a plain download instead, because the macOS/Windows share
 * sheet offers AirDrop, Mail and Messages but no way to keep the file.
 * Primary pointer decides, so a touchscreen laptop driven by a trackpad still
 * counts as a computer.
 */
const HANDHELD = "(hover: none) and (pointer: coarse)";
function subscribeHandheld(onChange: () => void) {
  const m = window.matchMedia(HANDHELD);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
function useHandheld(): boolean {
  return useSyncExternalStore(
    subscribeHandheld,
    () => window.matchMedia(HANDHELD).matches,
    () => false,
  );
}

/**
 * Share sheet on a handheld (AirDrop, messengers, Save to Photos), download
 * everywhere else, and wherever the sheet can't take files.
 *
 * With `allowBlocked`, a share sheet the browser refuses for lack of a fresh
 * tap reports "blocked" instead of downloading: Safari only opens it within a
 * few seconds of the tap, and encoding a clip takes longer than that. The
 * caller then offers a button, whose tap opens the sheet.
 */
async function shareOrDownload(
  blob: Blob,
  filename: string,
  title: string,
  { sheet, allowBlocked = false }: { sheet: boolean; allowBlocked?: boolean },
): Promise<"shared" | "downloaded" | "blocked"> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (sheet && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (err) {
      // A cancelled share sheet is not a failure — don't fall back to a
      // surprise download the person just declined.
      if ((err as Error)?.name === "AbortError") return "shared";
      if (allowBlocked && (err as Error)?.name === "NotAllowedError") return "blocked";
    }
  }
  download(blob, filename);
  return "downloaded";
}

export function ShareDialog({
  open,
  onClose,
  design,
  currentSlug,
  onShared,
  initialPanel = "choose",
}: {
  open: boolean;
  onClose: () => void;
  design: Design;
  /** Which half to land on. "community" is how the page reopens the dialog
   *  after a sign-in that started here. */
  initialPanel?: Panel;
  /** Slug this design already lives under, if any — reused so sharing twice
   *  doesn't scatter duplicate rows. */
  currentSlug: string | null;
  /** Told the slug a successful action produced, so the page can remember it. */
  onShared: (slug: string, kind: "link" | "community") => void;
}) {
  const { t, locale } = useI18n();
  const { data: session } = useSession();
  const handheld = useHandheld();
  // The stage's R3F store: exports render through its renderer at full size.
  const threeRef = useRef<RootState["get"] | null>(null);

  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A finished clip waiting for a tap on "Share the clip" (see shareOrDownload).
  const [readyClip, setReadyClip] = useState<{ blob: Blob; filename: string } | null>(null);
  // Whole percent while a clip is being made (the WebAssembly encoder on older
  // browsers takes long enough that a bare "Recording…" looks stuck).
  const [clipPct, setClipPct] = useState<number | null>(null);

  // Sign-in has to hand the design back, not the homepage. The callback keeps
  // the page's own URL (?d=<slug> included) and adds ?share=community, which
  // the configurator reads on load to reopen this dialog right here — so the
  // person carries on submitting instead of wondering where their work went.
  const [loginHref, setLoginHref] = useState("/login?callbackUrl=%2Fdesign%3Fshare%3Dcommunity");

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams(window.location.search);
    params.set("share", "community");
    const back = `${window.location.pathname}?${params.toString()}`;
    setLoginHref(`/login?callbackUrl=${encodeURIComponent(back)}`);
  }, [open, currentSlug]);

  // Community form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ItemCategory>("shelves");
  // Only asked for once "Other" is picked: the designer's own name for a type
  // the list doesn't have yet.
  const [customType, setCustomType] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Fresh dialog every time it opens.
  useEffect(() => {
    if (open) {
      setPanel(initialPanel);
      setStatus(null);
      setError(null);
      setSubmitted(false);
      setReadyClip(null);
    }
  }, [open, initialPanel]);

  const saveImage = useCallback(async () => {
    const three = threeRef.current;
    if (!three || busy) return;
    setBusy("image");
    setError(null);
    try {
      const blob = await renderPicture(three);
      const how = await shareOrDownload(blob, "myble-design.png", t("design.shareDialog.title"), { sheet: handheld });
      posthog.capture("design_media_shared", { kind: "image", how });
      setStatus(t(how === "shared" ? "design.shareDialog.shared" : "design.shareDialog.downloaded"));
    } catch {
      setError(t("design.shareDialog.mediaError"));
    } finally {
      setBusy(null);
    }
  }, [busy, handheld, t]);

  const recordVideo = useCallback(async () => {
    const three = threeRef.current;
    if (!three || busy) return;
    setBusy("video");
    setError(null);
    setReadyClip(null);
    setClipPct(0);
    setStatus(null);
    try {
      let shown = 0;
      const clip = await renderClip(three, (fraction) => {
        const pct = Math.round(fraction * 100);
        if (pct !== shown) setClipPct((shown = pct));
      });
      setClipPct(null);
      const filename = `myble-design.${clip.extension}`;
      const how = await shareOrDownload(clip.blob, filename, t("design.shareDialog.title"), {
        sheet: handheld,
        allowBlocked: true,
      });
      if (how === "blocked") {
        setReadyClip({ blob: clip.blob, filename });
        setStatus(t("design.shareDialog.clipReady"));
        return;
      }
      posthog.capture("design_media_shared", { kind: "video", how, format: clip.extension });
      setStatus(t(how === "shared" ? "design.shareDialog.shared" : "design.shareDialog.downloaded"));
    } catch (err) {
      setError(
        t((err as Error)?.message === "video_unsupported" ? "design.shareDialog.videoUnsupported" : "design.shareDialog.mediaError"),
      );
      setStatus(null);
    } finally {
      setClipPct(null);
      setBusy(null);
    }
  }, [busy, handheld, t]);

  const shareReadyClip = useCallback(async () => {
    if (!readyClip) return;
    const how = await shareOrDownload(readyClip.blob, readyClip.filename, t("design.shareDialog.title"), {
      sheet: handheld,
    });
    posthog.capture("design_media_shared", { kind: "video", how, format: readyClip.filename.split(".").pop() });
    setReadyClip(null);
    setStatus(t(how === "shared" ? "design.shareDialog.shared" : "design.shareDialog.downloaded"));
  }, [handheld, readyClip, t]);

  const copyLink = useCallback(async () => {
    if (busy) return;
    setBusy("link");
    setError(null);
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, locale }),
      });
      const body = await res.json();
      if (!res.ok || !body?.slug) throw new Error("save_failed");
      const url = `${window.location.origin}/design?d=${body.slug}`;
      await navigator.clipboard.writeText(url);
      onShared(body.slug, "link");
      posthog.capture("design_shared", { slug: body.slug, parts_count: design.parts.length });
      setStatus(t("design.shareDialog.linkCopied"));
    } catch {
      setError(t("design.shareDialog.linkError"));
    } finally {
      setBusy(null);
    }
  }, [busy, design, locale, onShared, t]);

  const submitToLibrary = useCallback(async () => {
    if (busy || title.trim().length < 2) return;
    setBusy("submit");
    setError(null);
    try {
      const res = await fetch("/api/community/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design,
          locale,
          title: title.trim(),
          note: note.trim(),
          category,
          categoryCustom: category === "other" ? customType.trim() || undefined : undefined,
          slug: currentSlug ?? undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) throw new Error("submit_failed");
      onShared(body.slug, "community");
      posthog.capture("design_submitted_to_library", { slug: body.slug, category });
      setSubmitted(true);
    } catch {
      setError(t("design.shareDialog.submitError"));
    } finally {
      setBusy(null);
    }
  }, [busy, category, currentSlug, customType, design, locale, note, onShared, t, title]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/45 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("design.shareDialog.title")}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl ring-1 ring-zinc-200 sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("library.close")}
          className="press absolute right-3 top-3 z-10 rounded-full bg-white/92 p-1.5 text-zinc-500 ring-1 ring-zinc-900/10 backdrop-blur transition hover:text-zinc-900"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {/* The stage doubles as the source for both the PNG and the clip, so it
            is mounted for the whole dialog — switching panels must not tear
            down the GL context mid-recording. Portrait 9:16, the same crop the
            exported picture and clip come out in. */}
        <div className="flex justify-center rounded-t-3xl bg-[#ece7df] px-6 pb-5 pt-6">
          <div className="relative aspect-[9/16] h-[min(40vh,340px)] overflow-hidden rounded-2xl shadow-sm ring-1 ring-zinc-900/10">
            <ShelfViewer
              design={design}
              background={WALL}
              height="100%"
              interactive={false}
              autoRotate
              // Exports drive the renderer by hand; the loop must stay off
              // even if the dialog re-renders mid-export.
              paused={busy === "image" || busy === "video"}
              fitCamera
              capturable
              onCanvasReady={(_canvas, three) => {
                threeRef.current = three.get;
              }}
            />
          </div>
        </div>

        <div className="p-6 sm:p-7">
          {panel === "choose" && (
            <>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{t("design.shareDialog.title")}</h2>
              <p className="mt-1.5 text-sm text-zinc-600">{t("design.shareDialog.body")}</p>

              <div className="mt-5 grid gap-3">
                <ChoiceButton
                  title={t("design.shareDialog.mediaTitle")}
                  body={t("design.shareDialog.mediaBody")}
                  onClick={() => setPanel("media")}
                  icon="M4 16l4.5-6 3.5 4.5 2.5-3L20 16M4 5h16v14H4z"
                />
                <ChoiceButton
                  title={t("design.shareDialog.communityTitle")}
                  body={t("design.shareDialog.communityBody")}
                  onClick={() => setPanel("community")}
                  icon="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0"
                />
              </div>
            </>
          )}

          {panel === "media" && (
            <>
              <BackLink onClick={() => setPanel("choose")} label={t("design.shareDialog.back")} />
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
                {t("design.shareDialog.mediaTitle")}
              </h2>
              <p className="mt-1.5 text-sm text-zinc-600">
                {t(handheld ? "design.shareDialog.mediaHint" : "design.shareDialog.mediaHintDesktop")}
              </p>

              <div className="mt-5 grid gap-2.5">
                <ActionButton onClick={saveImage} busy={busy === "image"} primary>
                  {t(handheld ? "design.shareDialog.image" : "design.shareDialog.imageDownload")}
                </ActionButton>
                {readyClip ? (
                  <ActionButton onClick={shareReadyClip} busy={false} primary>
                    {t("design.shareDialog.shareClip")}
                  </ActionButton>
                ) : (
                  <ActionButton onClick={recordVideo} busy={busy === "video"}>
                    {busy === "video"
                      ? clipPct === null
                        ? t("design.shareDialog.recording")
                        : t("design.shareDialog.recordingPct", { pct: clipPct })
                      : t(handheld ? "design.shareDialog.video" : "design.shareDialog.videoDownload")}
                  </ActionButton>
                )}
                <ActionButton onClick={copyLink} busy={busy === "link"}>
                  {t("design.shareDialog.link")}
                </ActionButton>
              </div>
            </>
          )}

          {panel === "community" && (
            <>
              <BackLink onClick={() => setPanel("choose")} label={t("design.shareDialog.back")} />

              {submitted ? (
                <div className="mt-2">
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                    {t("design.shareDialog.sentTitle")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{t("design.shareDialog.sentBody")}</p>
                  <Link
                    href="/account/designs"
                    className="press mt-5 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
                  >
                    {t("design.shareDialog.sentCta")}
                  </Link>
                </div>
              ) : !session?.user ? (
                <div className="mt-2">
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                    {t("design.shareDialog.communityTitle")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{t("design.shareDialog.loginBody")}</p>
                  <Link
                    href={loginHref}
                    className="press mt-5 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    {t("design.shareDialog.loginCta")}
                  </Link>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitToLibrary();
                  }}
                  className="mt-2 space-y-4"
                >
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                    {t("design.shareDialog.communityTitle")}
                  </h2>
                  <p className="text-sm leading-6 text-zinc-600">{t("design.shareDialog.communityHint")}</p>

                  <div>
                    <label htmlFor="share-title" className="text-sm font-medium text-zinc-900">
                      {t("design.shareDialog.nameLabel")}
                    </label>
                    <input
                      id="share-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={60}
                      placeholder={t("design.shareDialog.namePlaceholder")}
                      className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="share-category" className="text-sm font-medium text-zinc-900">
                      {t("design.shareDialog.categoryLabel")}
                    </label>
                    <select
                      id="share-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ItemCategory)}
                      className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
                    >
                      {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                        <option key={c.id} value={c.id}>
                          {t(`library.categories.${c.id}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {category === "other" && (
                    <div>
                      <label htmlFor="share-custom-type" className="text-sm font-medium text-zinc-900">
                        {t("design.shareDialog.customTypeLabel")}
                      </label>
                      <input
                        id="share-custom-type"
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value)}
                        maxLength={40}
                        autoFocus
                        placeholder={t("design.shareDialog.customTypePlaceholder")}
                        className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="share-note" className="text-sm font-medium text-zinc-900">
                      {t("design.shareDialog.noteLabel")}
                    </label>
                    <textarea
                      id="share-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={280}
                      rows={3}
                      placeholder={t("design.shareDialog.notePlaceholder")}
                      className="mt-1.5 w-full resize-none rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <ActionButton
                    onClick={submitToLibrary}
                    busy={busy === "submit"}
                    primary
                    disabled={title.trim().length < 2}
                  >
                    {t("design.shareDialog.submit")}
                  </ActionButton>
                </form>
              )}
            </>
          )}

          {(status || error) && (
            <p className={`mt-4 text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>{error ?? status}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceButton({
  title,
  body,
  onClick,
  icon,
}: {
  title: string;
  body: string;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex items-start gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-zinc-200 transition hover:bg-zinc-50 hover:ring-zinc-300"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path d={icon} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-zinc-600">{body}</span>
      </span>
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  busy,
  primary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`press inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60 ${
        primary
          ? "bg-indigo-600 text-white hover:bg-indigo-500"
          : "bg-white text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
    >
      ← {label}
    </button>
  );
}
