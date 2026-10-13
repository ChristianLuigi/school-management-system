import { AdmissionsClient } from "@/components/admissions-client";
import { AdmissionsSummaryClient } from "@/components/admissions-summary-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { getServerTranslator } from "@/lib/i18n";
import { getSchoolNavigation } from "@/lib/navigation";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function AdmissionsPage() {
  const context = await getMeContext();
  const { locale, t } = await getServerTranslator();
  const effectiveRoles = resolveEffectiveRoles(context);
  const currentSchoolId = resolveCurrentSchoolId(context);

  const isSchoolAdmin = effectiveRoles.includes("SCHOOL_ADMIN");

  return (
    <SchoolModuleWorkspace
      compact
      title={t("nav.admissions")}
      description={
        locale === "fr"
          ? "De la candidature à l’inscription."
          : "From application to enrollment."
      }
      quickActions={
        effectiveRoles.includes("ADMIN_STAFF") && !isSchoolAdmin
          ? []
          : [
              {
                href: "/students",
                title: t("nav.students"),
                description: "Open official student records.",
              },
              {
                href: "/finance",
                title: t("nav.finance"),
                description: "Manage registration payments and invoices.",
              },
              {
                href: "/gradebooks",
                title: t("nav.gradebooks"),
                description: "Review academic setup and student progress.",
              },
            ].filter((action) =>
              getSchoolNavigation(effectiveRoles, locale).some(
                (item) => item.href === action.href,
              ),
            )
      }
      attentionItems={[]}
      mainTitle="Admissions"
      mainSubtitle="Create, search, and follow admission applications."
    >
      <div className="mb-6">
        <AdmissionsSummaryClient schoolId={currentSchoolId} />
      </div>

      <AdmissionsClient
        schoolId={currentSchoolId}
        canCreate={isSchoolAdmin || effectiveRoles.includes("ADMIN_STAFF")}
        officeOnly={!isSchoolAdmin && effectiveRoles.includes("ADMIN_STAFF")}
      />
    </SchoolModuleWorkspace>
  );
}
