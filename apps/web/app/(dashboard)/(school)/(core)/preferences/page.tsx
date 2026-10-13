import { PersonalAppearanceClient } from "@/components/personal-appearance-client";
import { getMeContext } from "@/lib/server-context";
import { getServerTranslator } from "@/lib/i18n";

export default async function PreferencesPage() {
  const context = await getMeContext();
  const { t } = await getServerTranslator();
  return <div className="space-y-6"><h1 className="text-2xl font-semibold">{t("nav.settings")}</h1><PersonalAppearanceClient userId={context.user.id} /></div>;
}
