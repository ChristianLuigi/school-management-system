import { AdmissionsClient } from "@/components/admissions-client";
import { AdmissionsSummaryClient } from "@/components/admissions-summary-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function AdmissionsPage() {
  const context = await getMeContext();
  const effectiveRoles = resolveEffectiveRoles(context);
  const currentSchoolId = resolveCurrentSchoolId(context);

  const isSchoolAdmin = effectiveRoles.includes("SCHOOL_ADMIN");

  return (
      <SchoolModuleWorkspace
        title="Admissions Workspace"
        description="Manage admission applications before creating official student records."
        roles={effectiveRoles}
        quickActions={[
          {
            href: "/students",
            title: "Students",
            description: "Open official student records.",
          },
          {
            href: "/finance",
            title: "Finance",
            description: "Manage registration payments and invoices.",
          },
          {
            href: "/gradebooks",
            title: "Academics",
            description: "Review academic setup and student progress.",
          },
        ]}
        attentionItems={[
          {
            tone: "blue",
            title: "Admissions are not active students yet",
            description:
              "Admission applications should be converted into official student files only after validation.",
          },
        ]}
        mainTitle="Admissions"
        mainSubtitle="Create, search, and follow admission applications."
      >
        <div className="mb-6">
          <AdmissionsSummaryClient schoolId={currentSchoolId} />
        </div>

        <AdmissionsClient schoolId={currentSchoolId} canCreate={isSchoolAdmin} />
      </SchoolModuleWorkspace>
  );
}
