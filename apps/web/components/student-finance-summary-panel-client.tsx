"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type StudentFinanceSummary = {
  student: {
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  totalsByCurrency: Array<{
    currencyCode: string;
    totalInvoiced: number;
    totalPaid: number;
    balanceDue: number;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string | null;
    invoiceStatus: string;
    issueDate: string | null;
    dueDate: string | null;
    currencyCode: string;
    totalAmount: number;
    paidAmount: number;
    balanceDue: number;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string | null;
    invoiceId: string | null;
    invoiceNumber: string | null;
    paymentStatus: string;
    paymentMethod: string | null;
    paymentReference: string | null;
    currencyCode: string;
    amount: number;
    paidAt: string | null;
    createdAt: string;
  }>;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function invoiceTone(status: string): BadgeTone {
  if (status === "PAID") return "green";
  if (status === "PARTIALLY_PAID") return "amber";
  if (status === "OVERDUE" || status === "VOID" || status === "CANCELLED") {
    return "red";
  }
  return "blue";
}

function invoiceLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Brouillon",
    ISSUED: "Émise",
    PARTIALLY_PAID: "Partiellement payée",
    PAID: "Payée",
    OVERDUE: "En retard",
    VOID: "Annulée",
    CANCELLED: "Annulée",
  };

  return labels[status] ?? status;
}

function paymentTone(status: string): BadgeTone {
  if (status === "PAID" || status === "CONFIRMED" || status === "RECORDED") {
    return "green";
  }
  if (status === "PENDING") return "amber";
  if (status === "CANCELLED" || status === "REVERSED") return "red";
  return "blue";
}

export function StudentFinanceSummaryPanelClient({
  schoolId,
  studentId,
  refreshKey = 0,
  canRecordPayments,
}: {
  schoolId: string;
  studentId: string;
  refreshKey?: number;
  canRecordPayments: boolean;
}) {
  const [summary, setSummary] = useState<StudentFinanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSummary() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/students/${studentId}/summary?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load finance summary.");
      }

      setSummary(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load finance summary.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, studentId, refreshKey]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Finance Summary
          </h3>

          <p className="mt-1 text-sm text-slate-600">
            Student billing, payments, and outstanding balance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadSummary}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <Link
            href={`/finance/students/${studentId}/statement`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Print Statement
          </Link>

          <Link
            href={`/finance?studentId=${studentId}`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open Finance
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!summary && !error ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading finance summary...
        </div>
      ) : null}

      {summary ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            {summary.totalsByCurrency.flatMap((totals) => [
              <div
                key={`${totals.currencyCode}-invoiced`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="text-sm text-slate-500">
                  Total invoiced ({totals.currencyCode})
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {money(totals.totalInvoiced, totals.currencyCode)}
                </div>
              </div>,
              <div
                key={`${totals.currencyCode}-paid`}
                className="rounded-2xl border border-green-200 bg-green-50 p-4"
              >
                <div className="text-sm text-green-800">
                  Total paid ({totals.currencyCode})
                </div>
                <div className="mt-2 text-2xl font-bold text-green-900">
                  {money(totals.totalPaid, totals.currencyCode)}
                </div>
              </div>,
              <div
                key={`${totals.currencyCode}-balance`}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="text-sm text-amber-800">
                  Balance due ({totals.currencyCode})
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-900">
                  {money(totals.balanceDue, totals.currencyCode)}
                </div>
              </div>,
            ])}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-900">
                Recent Invoices
              </div>

              <div className="mt-3 space-y-2">
                {summary.invoices.slice(0, 5).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/finance/invoices/${invoice.id}`}
                          className="font-medium text-slate-900 underline-offset-4 hover:underline"
                        >
                          {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                        </Link>
                        <div className="mt-1 text-xs text-slate-500">
                          Due: {invoice.dueDate ?? "-"}
                        </div>
                      </div>

                      <SchoolBadge tone={invoiceTone(invoice.invoiceStatus)}>
                        {invoiceLabel(invoice.invoiceStatus)}
                      </SchoolBadge>
                    </div>

                    <div className="mt-2 flex justify-between text-sm">
                      <span>Total</span>
                      <span className="font-semibold">
                        {money(invoice.totalAmount, invoice.currencyCode)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Balance</span>
                      <span>
                        {money(invoice.balanceDue, invoice.currencyCode)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/finance/invoices/${invoice.id}`}
                        className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"
                      >
                        Open Invoice
                      </Link>

                      <Link
                        href={`/finance/invoices/${invoice.id}/thermal?autoprint=1`}
                        className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Print 80mm
                      </Link>
                    </div>
                    {canRecordPayments &&
                    invoice.balanceDue > 0 &&
                    !["VOID", "CANCELLED"].includes(invoice.invoiceStatus) ? (
                      <div className="mt-3">
                        <Link
                          href={`/finance/cashier?${new URLSearchParams({
                            studentId,
                            invoiceId: invoice.id,
                          }).toString()}`}
                          className="inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                        >
                          Record in cashier
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ))}

                {summary.invoices.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    No invoices yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-900">
                Recent Payments
              </div>

              <div className="mt-3 space-y-2">
                {summary.payments.slice(0, 5).map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/finance/payments/${payment.id}/receipt`}
                          className="font-medium text-slate-900 underline-offset-4 hover:underline"
                        >
                          {payment.paymentNumber ?? payment.id.slice(0, 8)}
                        </Link>

                        <div className="mt-1 text-xs text-slate-500">
                          Invoice: {payment.invoiceNumber ?? "-"}
                        </div>
                      </div>

                      <SchoolBadge tone={paymentTone(payment.paymentStatus)}>
                        {payment.paymentStatus}
                      </SchoolBadge>
                    </div>

                    <div className="mt-2 flex justify-between text-sm">
                      <span>Amount</span>
                      <span className="font-semibold">
                        {money(payment.amount, payment.currencyCode)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500">
                      {payment.paidAt ?? payment.createdAt}
                      {payment.paymentMethod
                        ? ` - ${payment.paymentMethod}`
                        : ""}
                      {payment.paymentReference
                        ? ` - Ref: ${payment.paymentReference}`
                        : ""}
                    </div>

                    <Link
                      href={`/finance/payments/${payment.id}/receipt`}
                      className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"
                    >
                      Open Receipt
                    </Link>

                    <Link
                      href={`/finance/payments/${payment.id}/receipt/thermal?autoprint=1`}
                      className="mt-3 ml-2 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Print 80mm
                    </Link>
                  </div>
                ))}

                {summary.payments.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    No payments yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
