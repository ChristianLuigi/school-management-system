"use client";

import { useI18n } from "@/components/i18n-provider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
      <button
        type="button"
        onClick={() => setLocale("fr")}
        aria-pressed={locale === "fr"}
        className={`min-h-8 rounded px-2.5 text-xs font-semibold transition-colors ${
          locale === "fr"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        }`}
      >
        FR
      </button>

      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`min-h-8 rounded px-2.5 text-xs font-semibold transition-colors ${
          locale === "en"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        }`}
      >
        EN
      </button>
    </div>
  );
}
