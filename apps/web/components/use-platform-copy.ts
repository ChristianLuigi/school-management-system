"use client";
import { useCallback } from "react";
import { useT } from "next-i18next/client";

export function usePlatformCopy() {
  const { t } = useT("platform");
  return useCallback((text: string, params?: Record<string, string | number>) => String(t(text, { ...params, keySeparator: false })), [t]);
}
