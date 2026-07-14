import { StudentInvoicePrintClient } from "@/components/student-invoice-print-client";
import { SchoolPageHeader } from "@/components/school-ui";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function FinanceInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
      <div className="space-y-6">
        <div className="print:hidden">
          <SchoolPageHeader
            title="Student Invoice"
            description="Print or save the student invoice."
          />
        </div>

        <StudentInvoicePrintClient schoolId={currentSchoolId} invoiceId={id} />
      </div>
  );
}
