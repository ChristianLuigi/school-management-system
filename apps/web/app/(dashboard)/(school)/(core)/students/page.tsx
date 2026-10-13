import { StudentsManagementClient } from "@/components/students-management-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { getServerTranslator } from "@/lib/i18n";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function StudentsPage() {
  const context = await getMeContext();
  const { t } = await getServerTranslator();
  const effectiveRoles = resolveEffectiveRoles(context);
  const currentSchoolId = resolveCurrentSchoolId(context);
  const isSchoolAdmin = effectiveRoles.includes("SCHOOL_ADMIN");

  return (
    <SchoolModuleWorkspace
      title={t("nav.students")}
      description={t("students.directorySubtitle")}
      compact
      quickActions={
        effectiveRoles.includes("ADMIN_STAFF") && !isSchoolAdmin
          ? []
          : [
              {
                href: "/attendance",
                title: t("nav.attendance"),
                description: "Review student attendance by section.",
                icon: "attendance",
              },
              {
                href: "/gradebooks",
                title: t("nav.gradebooks"),
                description: "Review student academic records.",
                icon: "gradebooks",
              },
              {
                href: "/finance",
                title: t("nav.finance"),
                description: "Review student billing and payments.",
                icon: "finance",
              },
            ]
      }
      attentionItems={[]}
      mainTitle={t("students.directoryHeading")}
    >
      <StudentsManagementClient
        schoolId={currentSchoolId}
        canCreate={isSchoolAdmin || effectiveRoles.includes("ADMIN_STAFF")}
        canImport={isSchoolAdmin}
      />
    </SchoolModuleWorkspace>
  );
}
