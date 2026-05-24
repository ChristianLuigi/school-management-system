import { StudentPaymentReceiptClient } from "@/components/student-payment-receipt-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import { SchoolPageHeader } from "@/components/school-ui";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function FinancePaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <div className="space-y-6">
        <div className="print:hidden">
          <SchoolPageHeader
            title="Payment Receipt"
            description="Review and print a payment receipt."
          />
        </div>

        <StudentPaymentReceiptClient
          schoolId={currentSchoolId}
          paymentId={id}
        />
      </div>
    </SchoolPageShell>
  );
}
