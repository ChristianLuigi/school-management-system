import { PayrollRunDetailClient } from "@/components/payroll-run-detail-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const context = await getMeContext();
  const effectiveRoles = resolveEffectiveRoles(context);
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <SchoolModuleWorkspace
        title="Payroll Run"
        description="Review payroll items and mark salaries as paid."
        roles={effectiveRoles}
        quickActions={[
          {
            href: "/finance/payroll",
            title: "Payroll",
            description: "Return to payroll runs and staff profiles.",
          },
          {
            href: "/finance",
            title: "Finance Dashboard",
            description: "Return to the finance dashboard.",
          },
        ]}
        attentionItems={[
          {
            tone: "blue",
            title: "Payroll Lite",
            description:
              "This MVP records salary payments manually. Advanced deductions and statutory calculations come later.",
          },
        ]}
        mainTitle="Payroll Run Details"
        mainSubtitle="Validate staff salaries and record salary payments."
      >
        <PayrollRunDetailClient schoolId={currentSchoolId} runId={runId} />
      </SchoolModuleWorkspace>
    </SchoolPageShell>
  );
}
