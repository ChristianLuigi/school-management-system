import { SchoolDashboardOverviewClient } from "@/components/school-dashboard-overview-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function SchoolDashboardPage() {
  const context = await getMeContext();
  const effectiveRoles = resolveEffectiveRoles(context);
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell
      allowedRoles={["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"]}
    >
      <SchoolModuleWorkspace
        title="Dashboard"
        description="Overview of school operations, admissions, attendance, finance, and academics."
        roles={effectiveRoles}
        quickActions={[
          {
            href: "/demo",
            title: "Final Demo",
            description: "Open the guided client presentation roadmap.",
          },
          {
            href: "/admissions",
            title: "Admissions",
            description: "Manage applications and convert admitted students.",
          },
          {
            href: "/students",
            title: "Students",
            description: "Review student files, guardians, classes, and status.",
          },
          {
            href: "/finance",
            title: "Finance",
            description: "Manage invoices, payments, receipts, and payroll.",
          },
          {
            href: "/gradebooks",
            title: "Gradebooks",
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
        mainTitle="School Dashboard"
        mainSubtitle="Live operational summary for the active school."
      >
        <SchoolDashboardOverviewClient schoolId={currentSchoolId} />
      </SchoolModuleWorkspace>
    </SchoolPageShell>
  );
}
