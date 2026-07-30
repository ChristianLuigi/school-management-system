import { FinanceReconciliationClient } from "@/components/finance-reconciliation-client";
import { SchoolPageHeader } from "@/components/school-ui";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function FinanceReconciliationPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);

  return (
    <div className="space-y-6">
      <SchoolPageHeader
        title="Deposits and period close"
        description="Reconcile closed cashier sessions to bank deposits, require independent review, and lock completed financial periods."
      />
      <FinanceReconciliationClient schoolId={schoolId} />
    </div>
  );
}
