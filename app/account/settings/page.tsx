"use client";

import { useSession } from "next-auth/react";
import { useT } from "../../../lib/i18n";
import { LanguageSwitcher } from "../../../components/LanguageSwitcher";
import { NewsletterToggle } from "../../../components/account/NewsletterToggle";
import { Section } from "../../../components/account/ui";

export default function AccountSettings() {
  const t = useT();
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("account.settings.title")}</h1>

      <Section title={t("account.settings.profileTitle")}>
        <div className="flex items-center gap-4">
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-12 w-12 rounded-full ring-1 ring-zinc-200" />
          ) : null}
          <div>
            <p className="text-sm font-medium text-zinc-900">{user?.name ?? "—"}</p>
            <p className="text-sm text-zinc-500">{user?.email ?? "—"}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-400">{t("account.settings.managedByGoogle")}</p>
      </Section>

      <Section title={t("account.settings.languageTitle")}>
        <LanguageSwitcher />
      </Section>

      <Section title={t("account.settings.newsletterTitle")}>
        <NewsletterToggle />
      </Section>

      <Section title={t("account.settings.dataTitle")}>
        <p className="text-sm text-zinc-600">{t("account.settings.dataBody")}</p>
        <a
          href="/contact?subject=data-request"
          className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500"
        >
          {t("account.settings.dataRequestLink")}
        </a>
      </Section>
    </div>
  );
}
