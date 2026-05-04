import { FinanceOverviewClient } from "@/components/finance-overview-client";
import { FinanceWorkspaceClient } from "@/components/finance-workspace-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type DashboardSummary = {
  metrics: {
    totalInvoices: number;
    totalOutstanding: number;
    overdueInvoices: number;
  };
};

export default async function FinancePage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);
  const effectiveRoles = resolveEffectiveRoles(context);

  const dashboard = await serverApiGet<DashboardSummary>(
    `/dashboard/summary?schoolId=${currentSchoolId}&gradingPeriodId=44444444-4444-4444-8444-444444444441`,
  ).catch(() => null);

  const summary = dashboard
    ? {
        totalInvoices: dashboard.metrics.totalInvoices,
        totalOutstanding: dashboard.metrics.totalOutstanding,
        overdueInvoices: dashboard.metrics.overdueInvoices,
      }
    : {
        totalInvoices: 0,
        totalOutstanding: 0,
        overdueInvoices: 0,
      };

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <FinanceWorkspaceClient currentRoles={effectiveRoles} summary={summary}>
        <FinanceOverviewClient schoolId={currentSchoolId} />
      </FinanceWorkspaceClient>
    </SchoolPageShell>
  );
}
