import { PayrollApprovalInboxClient } from "@/components/payroll-approval-inbox-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function PayrollApprovalsPage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolModuleWorkspace
      title="Payroll Approvals"
      description="School Admin review and final authorization for staff payroll."
      quickActions={[
        {
          href: "/finance/payroll",
          title: "Payroll workspace",
          description: "Return to staff profiles and all payroll runs.",
        },
        {
          href: "/finance",
          title: "Finance dashboard",
          description: "Return to finance operations.",
        },
      ]}
      attentionItems={[
        {
          tone: "amber",
          title: "Final School Admin decision",
          description:
            "Confirm totals, staff coverage, preparer, reviewer, run version, and checksum before approval.",
        },
      ]}
      mainTitle="Approval Inbox"
      mainSubtitle="Only active School Administrators can approve or return these reviewed payroll runs."
    >
      <PayrollApprovalInboxClient schoolId={currentSchoolId} />
    </SchoolModuleWorkspace>
  );
}
