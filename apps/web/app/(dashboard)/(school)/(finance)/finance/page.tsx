import { FinanceDashboardClient } from "@/components/finance-dashboard-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function FinancePage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolModuleWorkspace
      title="Finance"
      description="Manage student invoices, payments, balances, receipts, and payroll."
      quickActions={[
        {
          href: "/finance/billing",
          title: "Billing plans",
          description:
            "Preview eligible students and generate duplicate-safe invoice batches from controlled fee plans.",
        },
        {
          href: "/finance/reconciliation",
          title: "Deposits and period close",
          description:
            "Match closed cashier sessions to reviewed bank deposits and lock completed financial periods.",
        },
        {
          href: "/finance/cashier",
          title: "Cashier",
          description:
            "Search a student, collect an invoice payment, reconcile the drawer, and print an audited receipt.",
        },
        {
          href: "/finance/corrections",
          title: "Corrections and credit notes",
          description:
            "Request, independently approve, and settle reversals, refunds, and invoice credits.",
        },
        {
          href: "/students",
          title: "Students",
          description:
            "Open a student file to review billing and create invoices.",
        },
        {
          href: "/admissions",
          title: "Admissions",
          description: "Review registration fees and admission receipts.",
        },
        {
          href: "/finance/payroll",
          title: "Payroll",
          description: "Prepare, review, approve, process, pay, and close controlled staff payroll runs.",
        },
      ]}
      attentionItems={[
        {
          tone: "blue",
          title: "Controlled cashier workflow",
          description:
            "Payments require an open daily cashier session. Close the session only after counting physical cash.",
        },
      ]}
      mainTitle="Finance Dashboard"
      mainSubtitle="Track invoices, payments, and outstanding student balances."
    >
      <FinanceDashboardClient schoolId={currentSchoolId} />
    </SchoolModuleWorkspace>
  );
}
