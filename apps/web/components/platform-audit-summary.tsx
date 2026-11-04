"use client";
import { useI18n } from "@/components/i18n-provider";
import { usePlatformCopy } from "@/components/use-platform-copy";
import { platformAuditCopy } from "@/lib/i18n/platform-copy";

/** Stored audit records stay unchanged; only their presentation is localized. */
export function PlatformAuditSummary({ summary, eventType }: { summary: string; eventType: string }) {
  const { locale } = useI18n();
  const pt = usePlatformCopy();
  if (locale === 'en') return <>{summary}</>;
  const copy = platformAuditCopy(summary, eventType);
  const params = copy.params?.role ? { ...copy.params, role: pt(copy.params.role) } : copy.params;
  return <>{pt(copy.key, params)}</>;
}
