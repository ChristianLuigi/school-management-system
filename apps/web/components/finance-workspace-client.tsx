"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { SchoolStatCard } from "@/components/school-ui";

type FinanceSummary = {
  totalInvoices: number;
  totalOutstanding: number;
  overdueInvoices: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function FinanceWorkspaceClient({
  currentRoles,
  summary,
  children,
}: {
  currentRoles: string[];
  summary?: FinanceSummary | null;
  children: ReactNode;
}) {
  const isSchoolAdmin = currentRoles.includes("SCHOOL_ADMIN");
  const isFinanceAdmin = currentRoles.includes("FINANCE_ADMIN");

  const quickActions = [
    {
      href: "/finance",
      title: "Finance Overview",
      description: "Review balances, invoice totals, and overdue items.",
    },
    {
      href: "/finance/actions",
      title: "Finance Actions",
      description: "Create and manage core billing and collection actions.",
    },
    {
      href: "/reports",
      title: "Financial Reports",
      description: "Review finance-oriented summaries and school reporting.",
    },
  ];

  if (isSchoolAdmin) {
    quickActions.push({
      href: "/students",
      title: "Review Students",
      description: "Check student records before billing or follow-up actions.",
    });
  }

  const attentionItems: Array<{
    tone: "green" | "amber" | "red" | "blue" | "neutral";
    title: string;
    description: string;
  }> = [
    {
      tone: "blue",
      title: "Finance should be reviewed operationally, not only at month-end",
      description:
        "Use this workspace to track overdue balances and billing readiness continuously.",
    },
  ];

  if (summary && summary.overdueInvoices > 0) {
    attentionItems.push({
      tone: "red",
      title: "Overdue invoices need action",
      description: `${summary.overdueInvoices} invoice(s) are overdue and should be reviewed.`,
    });
  }

  if (summary && summary.totalOutstanding > 0) {
    attentionItems.push({
      tone: "amber",
      title: "Outstanding balances are still open",
      description: `Current outstanding balance: ${money(summary.totalOutstanding)}.`,
    });
  }

  if (isFinanceAdmin) {
    attentionItems.push({
      tone: "green",
      title: "Finance admin priority",
      description:
        "Focus on invoice status, payments recorded, and overdue follow-up before reporting cycles.",
    });
  }

  if (isSchoolAdmin) {
    attentionItems.push({
      tone: "amber",
      title: "School admin priority",
      description:
        "Use finance visibility to support collections and keep school operations aligned with billing reality.",
    });
  }

  return (
    <SchoolModuleWorkspace
      title="Finance Workspace"
      description="Manage billing, outstanding balances, and financial follow-up from a clearer operational workspace."
      roles={currentRoles}
      quickActions={quickActions}
      attentionItems={attentionItems}
      mainTitle="Finance Operations"
      mainSubtitle="Use the finance area below to review invoices, outstanding balances, and billing activity."
    >
      <div className="space-y-6">
        {summary ? (
          <div className="grid gap-4 md:grid-cols-3">
            <SchoolStatCard label="Invoices" value={summary.totalInvoices} />
            <SchoolStatCard
              label="Outstanding"
              value={money(summary.totalOutstanding)}
            />
            <SchoolStatCard label="Overdue" value={summary.overdueInvoices} />
          </div>
        ) : null}

        {children}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-600">Need to go deeper?</div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/finance/actions"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-white"
            >
              Open Finance Actions
            </Link>
            <Link
              href="/reports"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-white"
            >
              Open Reports
            </Link>
          </div>
        </div>
      </div>
    </SchoolModuleWorkspace>
  );
}
