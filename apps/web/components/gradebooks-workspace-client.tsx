"use client";

import { useState } from "react";
import { GradebookApprovalClient } from "@/components/gradebook-approval-client";
import { GradebookOverviewClient } from "@/components/gradebook-overview-client";
import { GradebooksPageClient } from "@/components/gradebooks-page-client";
import { ReportCardGenerationClient } from "@/components/report-card-generation-client";
import { ReportCardReadinessClient } from "@/components/report-card-readiness-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";

type SectionSubject = {
  id: string;
  section_id: string;
  section_code: string;
  section_name_i18n: Record<string, string>;
  subject_code: string;
  subject_name_i18n: Record<string, string>;
};

type GradingPeriod = {
  id: string;
  name_i18n: Record<string, string>;
  sequence_no: number;
  is_current: boolean;
};

export function GradebooksWorkspaceClient({
  currentRoles,
  schoolId,
  userId,
  sectionSubjects,
  gradingPeriods,
}: {
  currentRoles: string[];
  schoolId: string;
  userId: string;
  sectionSubjects: SectionSubject[];
  gradingPeriods: GradingPeriod[];
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const isSchoolAdmin = currentRoles.includes("SCHOOL_ADMIN");
  const isTeacher = currentRoles.includes("TEACHER");

  const quickActions = [
    {
      href: "/gradebooks",
      title: "Open Gradebooks",
      description:
        "Manage assessments, score entry, and readiness for submission.",
    },
    {
      href: "/attendance",
      title: "Check Attendance",
      description:
        "Review attendance first when verifying academic activity by class.",
    },
    {
      href: "/academics",
      title: "Review Academic Structure",
      description:
        "Check section, subject, and grading period context before finalizing gradebooks.",
    },
  ];

  if (isSchoolAdmin) {
    quickActions.push({
      href: "/reports",
      title: "Open Reports",
      description:
        "Move from approved gradebooks toward reporting and publication controls.",
    });
  }

  const attentionItems: Array<{
    tone: "green" | "amber" | "red" | "blue" | "neutral";
    title: string;
    description: string;
  }> = [
    {
      tone: "amber",
      title: "Draft before publish",
      description:
        "Teachers should complete entry and submit gradebooks before administrative validation.",
    },
    {
      tone: "blue",
      title: "Readiness matters",
      description:
        "Assessment weights, score completeness, and workflow status should be reviewed before approval.",
    },
  ];

  if (isTeacher) {
    attentionItems.push({
      tone: "green",
      title: "Teacher workflow priority",
      description:
        "Use this workspace to finish score entry cleanly and submit only when the gradebook is truly ready.",
    });
  }

  if (isSchoolAdmin) {
    attentionItems.push({
      tone: "amber",
      title: "Admin review priority",
      description:
        "Focus on incomplete coverage, rejected submissions, and approval bottlenecks before publication.",
    });
  }

  return (
    <SchoolModuleWorkspace
      title="Gradebook Workspace"
      description="Manage scoring, submissions, and academic validation with a clearer workflow."
      quickActions={quickActions}
      attentionItems={attentionItems}
      mainTitle="Gradebook Operations"
      mainSubtitle="Review the workflow overview first, then use the operational area below."
    >
      <div className="space-y-6">
        <GradebookOverviewClient schoolId={schoolId} refreshKey={refreshKey} />

        <GradebookApprovalClient
          schoolId={schoolId}
          currentRoles={currentRoles}
          refreshKey={refreshKey}
          onChanged={() => setRefreshKey((value) => value + 1)}
        />

        <ReportCardReadinessClient
          schoolId={schoolId}
          currentRoles={currentRoles}
          refreshKey={refreshKey}
          onChanged={() => setRefreshKey((value) => value + 1)}
        />

        {isSchoolAdmin ? (
          <ReportCardGenerationClient schoolId={schoolId} />
        ) : null}

        <GradebooksPageClient
          userId={userId}
          sectionSubjects={sectionSubjects}
          gradingPeriods={gradingPeriods}
        />
      </div>
    </SchoolModuleWorkspace>
  );
}
