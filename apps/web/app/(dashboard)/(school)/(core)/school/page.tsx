import { SchoolDashboardOverviewClient } from "@/components/school-dashboard-overview-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { getServerTranslator } from "@/lib/i18n";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function SchoolDashboardPage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);
  const { t } = await getServerTranslator();

  return (
    <SchoolModuleWorkspace
      title={t("dashboard.title")}
      description={t("dashboard.description")}
      quickActions={[
        {
          href: "/demo",
          title: t("nav.demo"),
          description: "Open the guided client presentation roadmap.",
        },
        {
          href: "/admissions",
          title: t("nav.admissions"),
          description: "Manage applications and convert admitted students.",
        },
        {
          href: "/students",
          title: t("nav.students"),
          description: "Review student files, guardians, classes, and status.",
        },
        {
          href: "/finance",
          title: t("nav.finance"),
          description: "Manage invoices, payments, receipts, and payroll.",
        },
        {
          href: "/gradebooks",
          title: t("nav.gradebooks"),
          description: "Create assessments, enter scores, and print reports.",
        },
      ]}
      attentionItems={[
        {
          tone: "blue",
          title: "Final demo mode",
          description:
            "The core school workflow is connected from setup and admissions through reports, receipts, and payroll.",
        },
      ]}
      mainTitle={t("dashboard.schoolDashboard")}
      mainSubtitle={t("dashboard.liveOperationalSummary")}
    >
      <SchoolDashboardOverviewClient schoolId={currentSchoolId} />
    </SchoolModuleWorkspace>
  );
}
