import { StudentPaymentReceiptThermalClient } from "@/components/student-payment-receipt-thermal-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function StudentPaymentReceiptThermalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <StudentPaymentReceiptThermalClient
        schoolId={currentSchoolId}
        paymentId={id}
      />
    </SchoolPageShell>
  );
}