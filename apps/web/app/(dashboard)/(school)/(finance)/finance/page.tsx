import { FinanceCommandCenterClient } from "@/components/finance-command-center-client";
import { SchoolPageHeader } from "@/components/school-ui";
import { getServerTranslator } from "@/lib/i18n";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function FinancePage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);
  const { t } = await getServerTranslator();

  return (
    <div className="space-y-5">
      <SchoolPageHeader
        title={t("finance.title")}
        description={t("finance.dashboardDescription")}
      />
      <FinanceCommandCenterClient schoolId={currentSchoolId} />
    </div>
  );
}
