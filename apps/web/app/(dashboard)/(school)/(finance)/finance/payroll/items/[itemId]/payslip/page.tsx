import { PayrollPayslipClient } from "@/components/payroll-payslip-client";
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
      <div className="space-y-6">
        <SchoolPageHeader
          title="Payroll Payslip"
          description="Print or save the staff payslip."
        />

        <PayrollPayslipClient schoolId={currentSchoolId} itemId={itemId} />
      </div>
  );
}
