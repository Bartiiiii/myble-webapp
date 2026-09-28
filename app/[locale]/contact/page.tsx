"use client";

import Link from "../../../lib/localeNav";
import React, { useState } from "react";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { useI18n } from "../../../lib/i18n";

const DOC_SLUGS = ["terms-and-conditions", "complaints-procedure", "privacy-policy"] as const;

// Message form → /api/contact → `contact_messages`. The mailto link above
// stays as the fallback for people who prefer their own mail client.
function ContactForm() {
  const { t, locale } = useI18n();
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  // Deep-linked from My Account → Settings ("Request my data"), same pattern
  // LoginPage already uses for reading a query param at render time.
  const isDataRequest =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("subject") === "data-request";

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name")?.toString() ?? "",
          email: fd.get("email")?.toString() ?? "",
          message: fd.get("message")?.toString() ?? "",
          locale,
        }),
      });
      setState(res.ok ? "ok" : "error");
      if (res.ok) form.reset();
    } catch {
      setState("error");
    }
  }

  if (state === "ok") {
    return (
      <section className="mt-6 rounded-3xl bg-emerald-50 p-6 ring-1 ring-emerald-200">
        <p className="text-sm font-medium text-emerald-800">{t("contact.formOk")}</p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
      <h2 className="text-sm font-semibold text-zinc-900">{t("contact.formTitle")}</h2>
      <form onSubmit={send} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">{t("contact.formName")}</span>
          <input name="name" required maxLength={200} className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">{t("contact.formEmail")}</span>
          <input name="email" type="email" required maxLength={320} className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">{t("contact.formMessage")}</span>
          <textarea
            name="message"
            required
            maxLength={5000}
            rows={5}
            defaultValue={isDataRequest ? t("contact.dataRequestPrefill") : undefined}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={state === "loading"}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-400"
          >
            {state === "loading" ? t("contact.formSending") : t("contact.formSend")}
          </button>
          {state === "error" && <p className="mt-2 text-sm font-medium text-rose-600">{t("contact.formErr")}</p>}
        </div>
      </form>
    </section>
  );
}

// Contact / seller identification (imprint). The seller's legal identification
// (name, IČO, registered address) lives here rather than in the footer — a
// Czech sole trader must keep it present and reachable, just not necessarily
// on every page footer.
export default function ContactPage() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader variant="app" />

      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          ← {t("nav.backHome")}
        </Link>

        <p className="mt-6 text-sm font-semibold text-indigo-600">{t("contact.intro")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{t("contact.title")}</h1>
        <p className="mt-3 max-w-lg text-base leading-7 text-zinc-600">{t("contact.body")}</p>

        <section className="mt-8 rounded-3xl bg-zinc-50 p-6 ring-1 ring-zinc-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("contact.emailLabel")}</p>
          <a href="mailto:myble.eu@gmail.com" className="mt-1 block text-lg font-semibold text-indigo-600 hover:text-indigo-500">
            myble.eu@gmail.com
          </a>
          <p className="mt-1 text-sm text-zinc-500">{t("contact.emailNote")}</p>
        </section>

        <ContactForm />

        <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-900">{t("contact.sellerTitle")}</h2>
          <div className="mt-3 space-y-1 text-sm leading-6 text-zinc-600">
            <p className="font-medium text-zinc-900">{t("imprint.name")}</p>
            <p>{t("imprint.ico")}</p>
            <p>{t("imprint.address")}</p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-900">{t("contact.docsTitle")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {DOC_SLUGS.map((slug) => (
              <li key={slug}>
                <Link href={`/legal/${slug}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                  {t(`legal.docs.${slug}.title`)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
