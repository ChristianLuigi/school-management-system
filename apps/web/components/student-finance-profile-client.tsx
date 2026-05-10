"use client";

import { useState } from "react";
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
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
  };
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
  const [studentId, setStudentId] = useState("");
  const [profile, setProfile] = useState<StudentFinanceProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      if (!studentId.trim()) {
        throw new Error("Student ID is required.");
      }

      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/students/${studentId.trim()}/profile?${params.toString()}`,
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Student Finance Profile
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Review invoices, payments, and outstanding balance for one student.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm sm:min-w-[320px]"
          placeholder="Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        />

        <button
          type="button"
          disabled={loading}
          onClick={loadProfile}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Loading..." : "Load Profile"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {profile ? (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">Student</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {profile.student.firstName ?? ""} {profile.student.lastName ?? ""}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {profile.student.code ?? profile.student.id}
                </div>
              </div>

              <a
                href={`/finance/students/${profile.student.id}/statement`}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Print Statement
              </a>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Invoices</div>
              <div className="mt-2 text-2xl font-bold">
                {profile.summary.invoiceCount}
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm text-red-700">Overdue</div>
              <div className="mt-2 text-2xl font-bold text-red-900">
                {profile.summary.overdueCount}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Total Billed</div>
              <div className="mt-2 text-2xl font-bold">
                {money(profile.summary.totalBilled)}
              </div>
            </div>

            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="text-sm text-green-700">Total Paid</div>
              <div className="mt-2 text-2xl font-bold text-green-900">
                {money(profile.summary.totalPaid)}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm text-amber-700">Outstanding</div>
              <div className="mt-2 text-2xl font-bold text-amber-900">
                {money(profile.summary.totalOutstanding)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200">
            <div className="border-b border-slate-200 p-4">
              <h4 className="font-semibold text-slate-900">Invoices</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600">
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
                  {profile.invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        <a
                          href={`/finance/invoices/${invoice.id}`}
                          className="font-medium text-slate-900 underline-offset-4 hover:underline"
                        >
                          {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                        </a>
                        <div className="text-xs text-slate-500">
                          Issued: {invoice.issueDate}
                        </div>

                        {invoice.items.length > 0 ? (
                          <div className="mt-2 space-y-1 text-xs text-slate-500">
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
                          <div className="mt-1 text-xs text-red-700">
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
                  ))}

                  {profile.invoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No invoices found for this student.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200">
            <div className="border-b border-slate-200 p-4">
              <h4 className="font-semibold text-slate-900">Payments</h4>
            </div>

            <div className="space-y-2 p-4">
              {profile.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="font-semibold text-slate-900">
                      {money(payment.amount)}
                    </div>

                    <SchoolBadge tone={statusTone(payment.paymentStatus)}>
                      {payment.paymentStatus}
                    </SchoolBadge>
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {payment.paymentDate}
                    {payment.invoiceNumber ? ` - ${payment.invoiceNumber}` : ""}
                    {payment.method ? ` - ${payment.method}` : ""}
                    {payment.reference ? ` - Ref: ${payment.reference}` : ""}
                  </div>

                  {payment.notes ? (
                    <div className="mt-1 text-xs text-slate-600">
                      {payment.notes}
                    </div>
                  ) : null}
                </div>
              ))}

              {profile.payments.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
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

