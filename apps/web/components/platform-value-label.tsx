"use client";
import { useI18n } from "@/components/i18n-provider";
import { platformLabel } from "@/lib/platform-presentation";
import { platformFr } from "@/lib/i18n/platform-copy";
import { usePlatformCopy } from "@/components/use-platform-copy";
export function PlatformValueLabel({ value }: { value: string }) {
  const { locale } = useI18n();
  const pt = usePlatformCopy();
  return <>{value in platformFr ? pt(value) : /^[A-Z]+_/.test(value) ? pt("Recorded action") : platformLabel(value, locale)}</>;
}
