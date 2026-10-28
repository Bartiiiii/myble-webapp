"use client";

import { useMemo } from "react";
import { useI18n } from "../../lib/i18n";
import { promoCopy } from "../../lib/promoCopy";
import { FROM_PRICE } from "../../lib/quote";

/** Cheapest ready-made design, through the real pricing engine. */
export const LIBRARY_FROM_CZK = Math.min(...Object.values(FROM_PRICE));

export function usePromoCopy() {
  const { locale } = useI18n();
  return useMemo(() => promoCopy(locale, { libraryFrom: LIBRARY_FROM_CZK }), [locale]);
}
