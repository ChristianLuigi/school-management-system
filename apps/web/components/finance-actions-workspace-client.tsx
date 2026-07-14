"use client";

import { FinanceActionsPageClient } from "@/components/finance-actions-page-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";

export function FinanceActionsWorkspaceClient({
  currentRoles,
  schoolId,
  userId,
  academicYearId,
  gradingPeriodId,
}: {
  currentRoles: string[];
  schoolId: string;
  userId: string;
  academicYearId: string | null;
  gradingPeriodId: string | null;
}) {
  const quickActions = [
    {
      href: "/finance",
      title: "Finance Overview",
      description: "Return to the main finance overview and totals.",
    },
    {
      href: "/reports",
      title: "Financial Reports",
      description: "Move from actions into reporting and summary review.",
    },
  ];

  const attentionItems = [
    {
      tone: "amber" as const,
      title: "Use finance actions carefully",
      description:
        "Operational changes here can affect balances, collections, and reporting consistency.",
    },
    {
      tone: "blue" as const,
      title: "Keep student and billing context aligned",
      description:
        "Confirm the correct student, invoice, and intended action before submitting changes.",
    },
  ];

  return (
    <SchoolModuleWorkspace
      title="Finance Actions"
      description="Perform billing and finance operations from a cleaner action-focused workspace."
      quickActions={quickActions}
      attentionItems={attentionItems}
      mainTitle="Finance Action Center"
      mainSubtitle="Use the action area below for operational billing updates and finance workflows."
    >
      <FinanceActionsPageClient
        schoolId={schoolId}
        userId={userId}
        academicYearId={academicYearId}
        gradingPeriodId={gradingPeriodId}
      />
    </SchoolModuleWorkspace>
  );
}
