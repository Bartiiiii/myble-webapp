"use client";

import Link from "../../../../lib/localeNav";
import React from "react";
import { useT } from "../../../../lib/i18n";
import { EmptyState } from "../../../../components/account/ui";
import { SavedDesignCard, type SavedDesign } from "../../../../components/account/SavedDesignCard";

export default function AccountDesigns() {
  const t = useT();
  const [designs, setDesigns] = React.useState<SavedDesign[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/account/designs")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body?.ok) setDesigns(body.designs);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleRenamed(slug: string, name: string) {
    setDesigns((prev) => prev?.map((d) => (d.slug === slug ? { ...d, name } : d)) ?? prev);
  }

  function handleDeleted(slug: string) {
    setDesigns((prev) => prev?.filter((d) => d.slug !== slug) ?? prev);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("account.designs.title")}</h1>

      {designs === null ? null : designs.length === 0 ? (
        <EmptyState
          text={t("account.designs.empty")}
          hint={t("account.designs.emptyHint")}
          cta={
            <Link href="/design" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
              {t("account.designs.emptyCta")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((item) => (
            <SavedDesignCard key={item.slug} item={item} onRenamed={handleRenamed} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
