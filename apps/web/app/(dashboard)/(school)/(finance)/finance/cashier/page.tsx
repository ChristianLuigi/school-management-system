import { FinanceCashierClient } from "@/components/finance-cashier-client";
import { SchoolPageHeader } from "@/components/school-ui";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function FinanceCashierPage({
  searchParams,
}: {
  searchParams: Promise<{
    studentId?: string;
    invoiceId?: string;
  }>;
}) {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const query = await searchParams;

  return (
    <div className="space-y-6">
      <SchoolPageHeader
        title="Cashier"
        description="Record payments through a guided, reconciled daily cashier workflow."
      />
      <FinanceCashierClient
        schoolId={schoolId}
        initialStudentId={query.studentId}
        initialInvoiceId={query.invoiceId}
      />
    </div>
  );
}
