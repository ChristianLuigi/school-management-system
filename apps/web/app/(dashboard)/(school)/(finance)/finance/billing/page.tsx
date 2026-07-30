import { FinanceBillingClient } from "@/components/finance-billing-client";
import { SchoolPageHeader } from "@/components/school-ui";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function FinanceBillingPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);

  return (
    <div className="space-y-6">
      <SchoolPageHeader
        title="Billing plans and runs"
        description="Create controlled fee plans, preview eligible students, and generate invoices once per billing period."
      />
      <FinanceBillingClient schoolId={schoolId} />
    </div>
  );
}
