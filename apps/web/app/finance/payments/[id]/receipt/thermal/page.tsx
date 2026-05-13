import { FinancePaymentReceiptThermalClient } from "@/components/finance-payment-receipt-thermal-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function FinancePaymentReceiptThermalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <FinancePaymentReceiptThermalClient
        schoolId={currentSchoolId}
        paymentId={id}
      />
    </SchoolPageShell>
  );
}
