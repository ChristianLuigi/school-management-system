import { FinanceWorkspaceClient } from "@/components/finance-workspace-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type OverdueInvoice = {
  id: string;
  invoice_number: string;
  student_number: string;
  student_first_name: string;
  student_last_name: string;
  balance_due: string;
  due_date: string;
};

type DashboardSummary = {
  metrics: {
    totalInvoices: number;
    totalOutstanding: number;
    overdueInvoices: number;
  };
};

function numericAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function FinancePage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const effectiveRoles = resolveEffectiveRoles(context);

  const [overdue, dashboard] = await Promise.all([
    serverApiGet<OverdueInvoice[]>(
      `/finance/overdue?schoolId=${schoolId}`,
    ).catch(() => [] as OverdueInvoice[]),
    serverApiGet<DashboardSummary>(
      `/dashboard/summary?schoolId=${schoolId}&gradingPeriodId=44444444-4444-4444-8444-444444444441`,
    ).catch(() => null),
  ]);

  const summary = dashboard
    ? {
        totalInvoices: dashboard.metrics.totalInvoices,
        totalOutstanding: dashboard.metrics.totalOutstanding,
        overdueInvoices: dashboard.metrics.overdueInvoices,
      }
    : {
        totalInvoices: overdue.length,
        totalOutstanding: overdue.reduce(
          (total, item) => total + numericAmount(item.balance_due),
          0,
        ),
        overdueInvoices: overdue.length,
      };

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <FinanceWorkspaceClient currentRoles={effectiveRoles} summary={summary}>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Overdue List</h2>
          <div className="mt-4 space-y-3">
            {overdue.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <div className="font-semibold">
                  {item.invoice_number} &middot; {item.student_first_name}{" "}
                  {item.student_last_name}
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  Student #: {item.student_number} &middot; Balance:{" "}
                  {item.balance_due} &middot; Due: {item.due_date}
                </div>
              </div>
            ))}
            {overdue.length === 0 ? (
              <div className="text-sm text-slate-500">No overdue invoices.</div>
            ) : null}
          </div>
        </div>
      </FinanceWorkspaceClient>
    </SchoolPageShell>
  );
}
