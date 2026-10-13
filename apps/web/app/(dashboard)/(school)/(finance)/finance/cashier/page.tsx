import { FinanceCashierClient } from "@/components/finance-cashier-client";
import { SchoolPageHeader } from "@/components/school-ui";
import { getServerTranslator } from "@/lib/i18n";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function FinanceCashierPage({
  searchParams,
}: {
  searchParams: Promise<{
    studentId?: string;
    invoiceId?: string;
  }>;
}) {
  const context = await getMeContext();
  const { t } = await getServerTranslator();
  const schoolId = resolveCurrentSchoolId(context);
  const query = await searchParams;

  return (
    <div className="space-y-6">
      <SchoolPageHeader
        title={t("finance.cashier")}
        description={t("finance.cashierDescription")}
      />
      <FinanceCashierClient
        schoolId={schoolId}
        initialStudentId={query.studentId}
        initialInvoiceId={query.invoiceId}
      />
    </div>
  );
}
