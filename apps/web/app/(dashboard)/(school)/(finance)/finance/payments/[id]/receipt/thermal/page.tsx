import { StudentPaymentReceiptThermalClient } from "@/components/student-payment-receipt-thermal-client";
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
      <StudentPaymentReceiptThermalClient
        schoolId={currentSchoolId}
        paymentId={id}
      />
  );
}