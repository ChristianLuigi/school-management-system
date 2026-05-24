import { FinanceDashboardClient } from "@/components/finance-dashboard-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function FinancePage() {
  const context = await getMeContext();
  const effectiveRoles = resolveEffectiveRoles(context);
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <SchoolModuleWorkspace
        title="Finance"
        description="Manage student invoices, payments, balances, receipts, and payroll."
        roles={effectiveRoles}
        quickActions={[
          {
            href: "/students",
            title: "Students",
            description:
              "Open a student file to create invoices and record payments.",
          },
          {
            href: "/admissions",
            title: "Admissions",
            description: "Review registration fees and admission receipts.",
          },
          {
            href: "/finance/payroll",
            title: "Payroll",
            description: "Prepare staff payroll runs. Coming next.",
          },
        ]}
        attentionItems={[
          {
            tone: "amber",
            title: "MVP finance workflow",
            description:
              "For now, invoices and payments are created from the student profile. This dashboard centralizes recent activity.",
          },
        ]}
        mainTitle="Finance Dashboard"
        mainSubtitle="Track invoices, payments, and outstanding student balances."
      >
        <FinanceDashboardClient schoolId={currentSchoolId} />
      </SchoolModuleWorkspace>
    </SchoolPageShell>
  );
}