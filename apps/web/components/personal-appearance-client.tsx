"use client";

import { Moon, Sun, Monitor, Palette } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useTheme } from "@/components/theme-provider";
import type { Theme } from "@/lib/theme";

export function PersonalAppearanceClient({ userId }: { userId: string }) {
  const { locale } = useI18n();
  const { theme, setTheme } = useTheme();
  const fr = locale === "fr";
  const choices: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: fr ? "Clair" : "Light", icon: Sun },
    { value: "dark", label: fr ? "Sombre" : "Dark", icon: Moon },
    { value: "system", label: fr ? "Système" : "System", icon: Monitor },
  ];
  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Palette size={20} aria-hidden="true" />{fr ? "Apparence personnelle" : "Personal appearance"}</h2>
    <p className="mt-1 text-sm text-muted-foreground">{fr ? "Votre préférence est conservée dans ce navigateur, sans modifier celle de l’école." : "Your preference is saved in this browser without changing the school's settings."}</p>
    <div role="group" aria-label={fr ? "Thème" : "Theme"} className="mt-4 grid grid-cols-3 gap-3">
      {choices.map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-pressed={theme === value}
        onClick={() => {
          try { localStorage.setItem(`almac:appearance:${userId}`, value); } catch { /* Browser storage may be disabled. */ }
          setTheme(value, false);
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors ${theme === value ? "border-foreground bg-secondary text-secondary-foreground" : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"}`}>
        <Icon size={22} aria-hidden="true" />{label}
      </button>)}
    </div>
  </section>;
}
