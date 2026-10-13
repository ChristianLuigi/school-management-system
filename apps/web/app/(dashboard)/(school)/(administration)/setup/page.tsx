import { SetupPageClient } from "@/components/setup-page-client";
import { SchoolBrandingClient } from "@/components/school-branding-client";
import { PersonalAppearanceClient } from "@/components/personal-appearance-client";
import { getServerTranslator } from "@/lib/i18n";
import { Settings, GraduationCap } from "lucide-react";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function SetupPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const { locale } = await getServerTranslator();
  const fr = locale === "fr";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><Settings size={26} aria-hidden="true" />{fr ? "Paramètres" : "Settings"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{fr ? "Vos préférences et l’identité de votre école." : "Your preferences and your school's identity."}</p>
      </header>
      <PersonalAppearanceClient userId={context.user.id} />
      <SchoolBrandingClient schoolId={schoolId} />
      <details className="rounded-2xl border border-border bg-surface p-5">
        <summary className="cursor-pointer font-medium"><GraduationCap size={20} aria-hidden="true" className="mr-2 inline-block" />{fr ? "Configuration scolaire avancée" : "Advanced school setup"}</summary>
        <div className="mt-4"><SetupPageClient schoolId={schoolId} /></div>
      </details>
    </div>
  );
}
