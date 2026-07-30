import { FinanceCorrectionsClient } from "@/components/finance-corrections-client";
import { SchoolPageHeader } from "@/components/school-ui";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function FinanceCorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    paymentId?: string;
    invoiceId?: string;
  }>;
}) {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const query = await searchParams;

  return (
    <div className="space-y-6">
      <SchoolPageHeader
        title="Corrections and credit notes"
        description="Use approval-controlled reversals, refunds, and invoice credits without deleting financial history."
      />
      <FinanceCorrectionsClient
        schoolId={schoolId}
        initialPaymentId={query.paymentId}
        initialInvoiceId={query.invoiceId}
      />
    </div>
  );
}
