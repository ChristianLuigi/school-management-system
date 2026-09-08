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
        title="Students"
        description="Directory, enrollment, and student records."
        compact
        quickActions={[
          {
            href: "/attendance",
            title: "Attendance",
            description: "Review student attendance by section.",
            icon: "attendance",
          },
          {
            href: "/gradebooks",
            title: "Gradebooks",
            description: "Review student academic records.",
            icon: "gradebooks",
          },
          {
            href: "/finance",
            title: "Finance",
            description: "Review student billing and payments.",
            icon: "finance",
          },
        ]}
        attentionItems={[]}
        mainTitle="Student Records"
      >
        <StudentsManagementClient
          schoolId={currentSchoolId}
          canCreate={isSchoolAdmin}
        />
      </SchoolModuleWorkspace>
  );
}
