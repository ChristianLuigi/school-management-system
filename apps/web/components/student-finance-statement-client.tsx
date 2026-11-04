"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type StudentFinanceProfile = {
  schoolId: string;
  student: {
    id: string;
    code: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  summary: {
    invoiceCount: number;
    overdueCount: number;
  };
  totalsByCurrency: Array<{
    currencyCode: string;
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string | null;
    invoiceStatus: string;
    issueDate: string;
    dueDate: string | null;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    currencyCode: string;
    notes: string | null;
    daysOverdue: number | null;
    items: Array<{
      id: string;
      description: string;
      quantity: number;
      unitAmount: number;
      lineTotal: number;
    }>;
  }>;
  payments: Array<{
    id: string;
    invoiceId: string | null;
    invoiceNumber: string | null;
    paymentStatus: string;
    paymentDate: string;
    amount: number;
    currencyCode: string;
    method: string | null;
    reference: string | null;
    notes: string | null;
    createdAt: string;
  }>;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function statusTone(status: string): BadgeTone {
  if (status === "PAID" || status === "CONFIRMED") return "green";
  if (status === "OVERDUE") return "red";
  if (status === "PARTIALLY_PAID") return "amber";
  if (status === "VOID" || status === "CANCELLED") return "neutral";
  return "blue";
}

export function StudentFinanceStatementClient({
  schoolId,
  studentId,
}: {
  schoolId: string;
  studentId: string;
}) {
  const [profile, setProfile] = useState<StudentFinanceProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/students/${studentId}/profile?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load student statement.");
      }

      setProfile(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load student statement.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, studentId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance"
            className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface"
          >
            Back to Finance
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary"
          >
            Print / Save as PDF
          </button>
        </div>

        <button
          type="button"
          onClick={loadProfile}
          className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl bg-surface p-4 text-sm text-muted-foreground print:hidden">
          Loading student statement...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger print:hidden">
          {error}
        </div>
      ) : null}

      {profile ? (
        <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-surface p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="border-b border-border pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                  Student Financial Statement
                </div>

                <h1 className="mt-2 text-3xl font-bold text-foreground">
                  Finance Statement
                </h1>

                <div className="mt-1 text-sm text-muted-foreground">
                  Generated on {new Date().toLocaleDateString()}
                </div>
              </div>

              <div className="text-right">
                {profile.totalsByCurrency.some(
                  (totals) => totals.totalOutstanding > 0,
                ) ? (
                  <SchoolBadge tone="amber">Outstanding Balance</SchoolBadge>
                ) : (
                  <SchoolBadge tone="green">No Balance Due</SchoolBadge>
                )}

                {profile.summary.overdueCount > 0 ? (
                  <div className="mt-2">
                    <SchoolBadge tone="red">
                      {profile.summary.overdueCount} Overdue
                    </SchoolBadge>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-b border-border py-6 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Student
              </div>

              <div className="mt-1 text-xl font-bold text-foreground">
                {profile.student.firstName ?? ""} {profile.student.lastName ?? ""}
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                Code: {profile.student.code ?? "Code pending"}
              </div>
            </div>


            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Statement Type
              </div>

              <div className="mt-1 text-xl font-bold text-foreground">
                Account Summary
              </div>
            </div>
          </div>

          <div className="grid gap-4 py-6 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-surface p-5 print:bg-white">
              <div className="text-sm text-muted-foreground">Invoices</div>
              <div className="mt-2 text-3xl font-bold text-foreground">
                {profile.summary.invoiceCount}
              </div>
            </div>

            {profile.totalsByCurrency.flatMap((totals) => [
              <div
                key={`${totals.currencyCode}-billed`}
                className="rounded-2xl border border-border bg-surface p-5 print:bg-white"
              >
                <div className="text-sm text-muted-foreground">
                  Total Billed ({totals.currencyCode})
                </div>
                <div className="mt-2 text-2xl font-bold text-foreground">
                  {money(totals.totalBilled, totals.currencyCode)}
                </div>
              </div>,
              <div
                key={`${totals.currencyCode}-paid`}
                className="rounded-2xl border border-success/40 bg-success-subtle p-5 print:bg-white"
              >
                <div className="text-sm text-success">
                  Total Paid ({totals.currencyCode})
                </div>
                <div className="mt-2 text-2xl font-bold text-success">
                  {money(totals.totalPaid, totals.currencyCode)}
                </div>
              </div>,
              <div
                key={`${totals.currencyCode}-outstanding`}
                className="rounded-2xl border border-warning/40 bg-warning-subtle p-5 print:bg-white"
              >
                <div className="text-sm text-warning">
                  Outstanding ({totals.currencyCode})
                </div>
                <div className="mt-2 text-2xl font-bold text-warning">
                  {money(totals.totalOutstanding, totals.currencyCode)}
                </div>
              </div>,
            ])}
          </div>

          <div className="mt-2">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Invoices
            </h2>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-muted text-left text-muted-foreground print:bg-white">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Issue Date</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                  </tr>
                </thead>

                <tbody>
                  {profile.invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                        </div>

                        {invoice.items.length > 0 ? (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {invoice.items.map((item) => (
                              <div key={item.id}>
                                {item.description} - {item.quantity} x{" "}
                                {money(item.unitAmount, invoice.currencyCode)}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <SchoolBadge tone={statusTone(invoice.invoiceStatus)}>
                          {invoice.invoiceStatus}
                        </SchoolBadge>

                        {invoice.daysOverdue ? (
                          <div className="mt-1 text-xs text-danger">
                            {invoice.daysOverdue} day(s) overdue
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">{invoice.issueDate}</td>
                      <td className="px-4 py-3">{invoice.dueDate ?? "-"}</td>

                      <td className="px-4 py-3">
                        {money(invoice.totalAmount, invoice.currencyCode)}
                      </td>

                      <td className="px-4 py-3">
                        {money(invoice.amountPaid, invoice.currencyCode)}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {money(invoice.balanceDue, invoice.currencyCode)}
                      </td>
                    </tr>
                  ))}

                  {profile.invoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No invoices found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Payments
            </h2>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-muted text-left text-muted-foreground print:bg-white">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Receipt</th>
                  </tr>
                </thead>

                <tbody>
                  {profile.payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-border">
                      <td className="px-4 py-3">{payment.paymentDate}</td>

                      <td className="px-4 py-3">
                        {payment.invoiceNumber ?? payment.invoiceId ?? "-"}
                      </td>

                      <td className="px-4 py-3">
                        <SchoolBadge tone={statusTone(payment.paymentStatus)}>
                          {payment.paymentStatus}
                        </SchoolBadge>
                      </td>

                      <td className="px-4 py-3">{payment.method ?? "-"}</td>
                      <td className="px-4 py-3">{payment.reference ?? "-"}</td>

                      <td className="px-4 py-3 font-semibold">
                        {money(payment.amount, payment.currencyCode)}
                      </td>
                      <td className="px-4 py-3 print:hidden">
                        <a
                          href={`/finance/payments/${payment.id}/receipt`}
                          className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary"
                        >
                          Receipt
                        </a>
                      </td>
                    </tr>
                  ))}

                  {profile.payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No payments found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-10 grid gap-8 border-t border-border pt-10 md:grid-cols-2">
            <div className="h-24 border-t border-input pt-2 text-center text-sm text-muted-foreground">
              Finance Officer
            </div>

            <div className="h-24 border-t border-input pt-2 text-center text-sm text-muted-foreground">
              Parent / Guardian
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
