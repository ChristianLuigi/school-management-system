import { PayrollRunDetailClient } from "@/components/payroll-run-detail-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { getMeContext, hasSchoolRole, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);
  const isSchoolAdmin = hasSchoolRole(context, "SCHOOL_ADMIN");

  return (
    <SchoolModuleWorkspace
      title="Payroll Run"
      description="Review salary snapshots, workflow approvals, adjustments, payments, and close."
      quickActions={[
        {
          href: "/finance/payroll",
          title: "Payroll",
          description: "Return to payroll runs and staff profiles.",
        },
        ...(isSchoolAdmin
          ? [{
              href: "/finance/payroll/approvals",
              title: "Approval inbox",
              description: "Review payroll runs awaiting final School Admin approval.",
            }]
          : []),
        {
          href: "/finance",
          title: "Finance Dashboard",
          description: "Return to the finance dashboard.",
        },
      ]}
      attentionItems={[
        {
          tone: "blue",
          title: "Controlled payroll workflow",
          description:
            "Follow the review and approval sequence before processing payments. Closed runs remain locked and auditable.",
        },
      ]}
      mainTitle="Payroll Run Details"
      mainSubtitle="Validate salary snapshots, approve independently, process payments, and close the run."
    >
      <PayrollRunDetailClient
        schoolId={currentSchoolId}
        runId={runId}
        isSchoolAdmin={isSchoolAdmin}
      />
    </SchoolModuleWorkspace>
  );
}
