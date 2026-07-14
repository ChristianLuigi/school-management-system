import { ReactNode } from "react";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { getServerTranslator } from "@/lib/i18n";

export async function AcademicsWorkspace({
  currentRoles,
  children,
}: {
  currentRoles: string[];
  children: ReactNode;
}) {
  const { t } = await getServerTranslator();
  const isSchoolAdmin = currentRoles.includes("SCHOOL_ADMIN");
  const isTeacher = currentRoles.includes("TEACHER");

  const quickActions = [
    {
      href: "/academic-structure",
      title: t("academic.quickActionStructureTitle"),
      description: t("academic.quickActionStructureDescription"),
    },
    {
      href: "/attendance",
      title: t("academic.quickActionAttendanceTitle"),
      description: t("academic.quickActionAttendanceDescription"),
    },
    {
      href: "/gradebooks",
      title: t("academic.quickActionGradebookTitle"),
      description: t("academic.quickActionGradebookDescription"),
    },
  ];

  if (isSchoolAdmin) {
    quickActions.push({
      href: "/setup",
      title: t("academic.quickActionSettingsTitle"),
      description: t("academic.quickActionSettingsDescription"),
    });
  }

  const attentionItems: Array<{
    tone: "green" | "amber" | "red" | "blue" | "neutral";
    title: string;
    description: string;
  }> = [
    {
      tone: "blue" as const,
      title: t("academic.attentionStructureTitle"),
      description: t("academic.attentionStructureDescription"),
    },
    {
      tone: "amber" as const,
      title: t("academic.attentionTeacherSubjectTitle"),
      description: t("academic.attentionTeacherSubjectDescription"),
    },
  ];

  if (isTeacher) {
    attentionItems.push({
      tone: "green" as const,
      title: t("academic.attentionTeacherPriorityTitle"),
      description: t("academic.attentionTeacherPriorityDescription"),
    });
  }

  if (isSchoolAdmin) {
    attentionItems.push({
      tone: "amber" as const,
      title: t("academic.attentionAdminPriorityTitle"),
      description: t("academic.attentionAdminPriorityDescription"),
    });
  }

  return (
    <SchoolModuleWorkspace
      title={t("academic.workspaceTitle")}
      description={t("academic.workspaceDescription")}
      quickActions={quickActions}
      attentionItems={attentionItems}
      mainTitle={t("academic.academicOperations")}
      mainSubtitle={t("academic.academicOperationsDescription")}
    >
      {children}
    </SchoolModuleWorkspace>
  );
}