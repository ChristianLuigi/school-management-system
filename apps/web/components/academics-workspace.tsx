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

  const quickActions: Array<{
    href: string;
    title: string;
    description: string;
    icon: "academics" | "attendance" | "gradebooks" | "settings";
  }> = [
    {
      href: "/attendance",
      title: t("academic.quickActionAttendanceTitle"),
      description: t("academic.quickActionAttendanceDescription"),
      icon: "attendance" as const,
    },
    {
      href: "/gradebooks",
      title: t("academic.quickActionGradebookTitle"),
      description: t("academic.quickActionGradebookDescription"),
      icon: "gradebooks" as const,
    },
  ];

  if (isSchoolAdmin) {
    quickActions.unshift({
      href: "/academic-structure",
      title: t("academic.quickActionStructureTitle"),
      description: t("academic.quickActionStructureDescription"),
      icon: "academics" as const,
    });
    quickActions.push({
      href: "/setup",
      title: t("academic.quickActionSettingsTitle"),
      description: t("academic.quickActionSettingsDescription"),
      icon: "settings" as const,
    });
  }

  const attentionItems: Array<{
    tone: "green" | "amber" | "red" | "blue" | "neutral";
    title: string;
    description: string;
  }> = [];

  return (
    <SchoolModuleWorkspace
      title={t("academic.workspaceTitle")}
      description={t("academic.workspaceDescription")}
      compact
      quickActions={quickActions}
      attentionItems={attentionItems}
      mainTitle={t("academic.academicOperations")}
      mainSubtitle={t("academic.academicOperationsDescription")}
    >
      {children}
    </SchoolModuleWorkspace>
  );
}
