"use client";

import { useState } from "react";
import { AttendanceAdminReviewClient } from "@/components/attendance-admin-review-client";
import { AttendanceOfflineStatusClient } from "@/components/attendance-offline-status-client";
import { AttendanceOverviewClient } from "@/components/attendance-overview-client";
import { AttendancePageClient } from "@/components/attendance-page-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";

export function AttendanceWorkspaceClient({
  currentRoles,
  schoolId,
  userId,
}: {
  currentRoles: string[];
  schoolId: string;
  userId: string;
}) {
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);

  const isSchoolAdmin = currentRoles.includes("SCHOOL_ADMIN");
  const isTeacher = currentRoles.includes("TEACHER");

  const quickActions = [
    {
      href: "/attendance",
      title: "Record Attendance",
      description: "Take or update attendance for the active class session.",
    },
    {
      href: "/academics",
      title: "Review Academics",
      description: "Check grade levels, sections, and subject organization.",
    },
  ];

  if (isSchoolAdmin) {
    quickActions.push({
      href: "/students",
      title: "Open Students",
      description: "Review student records before updating attendance.",
    });
  }

  if (isSchoolAdmin || isTeacher) {
    quickActions.push({
      href: "/gradebooks",
      title: "Open Gradebooks",
      description: "Move from attendance into assessment and publishing work.",
    });
  }

  const attentionItems: Array<{
    tone: "green" | "amber" | "red" | "blue" | "neutral";
    title: string;
    description: string;
  }> = [
    {
      tone: "amber",
      title: "Use attendance as a daily operational checkpoint",
      description:
        "Morning and afternoon attendance should be completed consistently before end-of-day reporting.",
    },
    {
      tone: "blue",
      title: "Attendance works best with section discipline",
      description:
        "Confirm the correct section, date, and slot before submitting records.",
    },
  ];

  if (isTeacher) {
    attentionItems.push({
      tone: "green",
      title: "Teacher workflow priority",
      description:
        "Complete attendance first, then continue with gradebook work for the same class context.",
    });
  }

  if (isSchoolAdmin) {
    attentionItems.push({
      tone: "amber",
      title: "Admin review priority",
      description:
        "Watch for missing sessions, late submissions, and attendance anomalies across sections.",
    });
  }

  return (
    <SchoolModuleWorkspace
      title="Attendance Workspace"
      description="Manage daily attendance operations with a clearer teaching and supervision flow."
      roles={currentRoles}
      quickActions={quickActions}
      attentionItems={attentionItems}
      mainTitle="Attendance Operations"
      mainSubtitle="Review the daily overview first, then use the operational form below."
    >
      <div className="space-y-6">
        <AttendanceOverviewClient
          schoolId={schoolId}
          refreshKey={overviewRefreshKey}
        />
        <AttendanceOfflineStatusClient
          onSynced={() => setOverviewRefreshKey((value) => value + 1)}
        />
        {isSchoolAdmin ? (
          <AttendanceAdminReviewClient
            schoolId={schoolId}
            onLocked={() => setOverviewRefreshKey((value) => value + 1)}
          />
        ) : null}
        <AttendancePageClient
          schoolId={schoolId}
          userId={userId}
          onSubmitted={() => setOverviewRefreshKey((value) => value + 1)}
        />
      </div>
    </SchoolModuleWorkspace>
  );
}