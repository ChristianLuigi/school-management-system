import { PayrollPayslipClient } from "@/components/payroll-payslip-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import { SchoolPageHeader } from "@/components/school-ui";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function PayrollPayslipPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <div className="space-y-6">
        <SchoolPageHeader
          title="Payroll Payslip"
          description="Print or save the staff payslip."
        />

        <PayrollPayslipClient schoolId={currentSchoolId} itemId={itemId} />
      </div>
    </SchoolPageShell>
  );
}
