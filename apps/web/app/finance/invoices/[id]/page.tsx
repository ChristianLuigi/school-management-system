import { FinanceInvoiceDetailClient } from "@/components/finance-invoice-detail-client";
import { SchoolPageShell } from "@/components/school-page-shell";
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
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <div className="space-y-6">
        <div className="print:hidden">
          <SchoolPageHeader
            title="Invoice Detail"
            description="Review, print, and manage an invoice."
          />
        </div>

        <FinanceInvoiceDetailClient schoolId={currentSchoolId} invoiceId={id} />
      </div>
    </SchoolPageShell>
  );
}
