import { StudentsManagementClient } from "@/components/students-management-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function StudentsPage() {
  const context = await getMeContext();
  const effectiveRoles = resolveEffectiveRoles(context);
  const currentSchoolId = resolveCurrentSchoolId(context);
  const isSchoolAdmin = effectiveRoles.includes("SCHOOL_ADMIN");

  return (
      <SchoolModuleWorkspace
        title="Students Workspace"
        description="Manage student records and enrollment visibility."
        quickActions={[
          {
            href: "/attendance",
            title: "Attendance",
            description: "Review student attendance by section.",
          },
          {
            href: "/gradebooks",
            title: "Gradebooks",
            description: "Review student academic records.",
          },
          {
            href: "/finance",
            title: "Finance",
            description: "Review student billing and payments.",
          },
        ]}
        attentionItems={[
          {
            tone: "blue",
            title: "Student records are school-specific",
            description:
              "Students created here belong to the currently selected school workspace.",
          },
        ]}
        mainTitle="Student Records"
        mainSubtitle="Create and search students using human-friendly student codes."
      >
        <StudentsManagementClient
          schoolId={currentSchoolId}
          canCreate={isSchoolAdmin}
        />
      </SchoolModuleWorkspace>
  );
}
