"use client";

import { PaginatedCollection } from "@/components/paginated-collection";
import { useState } from "react";
import { SchoolBadge } from "@/components/school-ui";
import { StudentSelectorClient } from "@/components/student-selector-client";
import type { SelectedStudent } from "@/components/student-selector-client";

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

export function StudentFinanceProfileClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
  const [profile, setProfile] = useState<StudentFinanceProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      if (!selectedStudent) {
        throw new Error("Please select a student.");
      }

      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/students/${selectedStudent!.id}/profile?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          body?.message ?? "Failed to load student finance profile.",
        );
      }

      setProfile(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load student finance profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Student Finance Profile
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Review invoices, payments, and outstanding balance for one student.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <StudentSelectorClient
          schoolId={schoolId}
          selectedStudent={selectedStudent}
          onSelect={(student) => {
            setSelectedStudent(student);
            setProfile(null);
          }}
          label="Select Student"
        />

        <button
          type="button"
          disabled={loading || !selectedStudent}
          onClick={loadProfile}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
        >
          {loading ? "Loading..." : "Load Profile"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {profile ? (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm text-muted-foreground">Student</div>
                <div className="mt-1 text-2xl font-bold text-foreground">
                  {profile.student.firstName ?? ""} {profile.student.lastName ?? ""}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {profile.student.code ?? "Code pending"}
                </div>
              </div>

              <a
                href={`/finance/students/${profile.student.id}/statement`}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary"
              >
                Print Statement
              </a>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Invoices</div>
              <div className="mt-2 text-2xl font-bold">
                {profile.summary.invoiceCount}
              </div>
            </div>

            <div className="rounded-2xl border border-danger/40 bg-danger-subtle p-4">
              <div className="text-sm text-danger">Overdue</div>
              <div className="mt-2 text-2xl font-bold text-danger">
                {profile.summary.overdueCount}
              </div>
            </div>

            {profile.totalsByCurrency.flatMap((totals) => [
              <div
                key={`${totals.currencyCode}-billed`}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="text-sm text-muted-foreground">
                  Total Billed ({totals.currencyCode})
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {money(totals.totalBilled, totals.currencyCode)}
                </div>
              </div>,
              <div
                key={`${totals.currencyCode}-paid`}
                className="rounded-2xl border border-success/40 bg-success-subtle p-4"
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
                className="rounded-2xl border border-warning/40 bg-warning-subtle p-4"
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

          <div className="rounded-2xl border border-border">
            <div className="border-b border-border p-4">
              <h4 className="font-semibold text-foreground">Invoices</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                  </tr>
                </thead>

                <tbody>
                  {<PaginatedCollection items={profile.invoices} rows columns={6}>{(invoice) => (
                    <tr key={invoice.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <a
                          href={`/finance/invoices/${invoice.id}`}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                        </a>
                        <div className="text-xs text-muted-foreground">
                          Issued: {invoice.issueDate}
                        </div>

                        {invoice.items.length > 0 ? (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {invoice.items.slice(0, 3).map((item) => (
                              <div key={item.id}>
                                {item.description} - {item.quantity} x{" "}
                                {money(item.unitAmount, invoice.currencyCode)}
                              </div>
                            ))}

                            {invoice.items.length > 3 ? (
                              <div>+{invoice.items.length - 3} more item(s)</div>
                            ) : null}
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
                  )}</PaginatedCollection>}

                  {profile.invoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No invoices found for this student.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-border">
            <div className="border-b border-border p-4">
              <h4 className="font-semibold text-foreground">Payments</h4>
            </div>

            <div className="space-y-2 p-4">
              {<PaginatedCollection items={profile.payments}>{(payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-border bg-surface p-3 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="font-semibold text-foreground">
                      {money(payment.amount, payment.currencyCode)}
                    </div>

                    <SchoolBadge tone={statusTone(payment.paymentStatus)}>
                      {payment.paymentStatus}
                    </SchoolBadge>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {payment.paymentDate}
                    {payment.invoiceNumber ? ` - ${payment.invoiceNumber}` : ""}
                    {payment.method ? ` - ${payment.method}` : ""}
                    {payment.reference ? ` - Ref: ${payment.reference}` : ""}
                  </div>

                  {payment.notes ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {payment.notes}
                    </div>
                  ) : null}
                </div>
              )}</PaginatedCollection>}

              {profile.payments.length === 0 ? (
                <div className="rounded-xl bg-surface p-3 text-sm text-muted-foreground">
                  No payments found for this student.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
