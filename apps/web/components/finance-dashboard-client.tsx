"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type FinanceDashboard = {
  totals: {
    totalInvoiced: number;
    totalPaid: number;
    totalBalanceDue: number;
    invoiceCount: number;
    unpaidInvoiceCount: number;
    paidInvoiceCount: number;
    paymentCount: number;
  };
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string | null;
    invoiceTitle: string | null;
    invoiceStatus: string;
    issueDate: string | null;
    dueDate: string | null;
    currencyCode: string;
    totalAmount: number;
    paidAmount: number;
    balanceDue: number;
    createdAt: string;
    student: {
      id: string;
      studentCode: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  }>;
  recentPayments: Array<{
    id: string;
    paymentNumber: string | null;
    paymentStatus: string;
    paymentMethod: string | null;
    paymentReference: string | null;
    currencyCode: string;
    amount: number;
    paidAt: string | null;
    createdAt: string;
    invoice: {
      id: string;
      invoiceNumber: string | null;
    } | null;
    student: {
      id: string;
      studentCode: string | null;
      firstName: string | null;
      lastName: string | null;
    };
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
  if (["OVERDUE", "VOID", "CANCELLED"].includes(status)) return "red";
  return "blue";
}

function invoiceLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Brouillon",
    ISSUED: "Emise",
    PARTIALLY_PAID: "Partiellement payee",
    PAID: "Payee",
    OVERDUE: "En retard",
    VOID: "Annulee",
    CANCELLED: "Annulee",
  };

  return labels[status] ?? status;
}

function paymentTone(status: string): BadgeTone {
  if (["CONFIRMED", "PAID", "RECORDED"].includes(status)) return "green";
  if (status === "PENDING") return "amber";
  if (["CANCELLED", "REVERSED"].includes(status)) return "red";
  return "blue";
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass =
    tone === "green"
      ? "border-green-200 bg-green-50 text-green-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "red"
          ? "border-red-200 bg-red-50 text-red-900"
          : tone === "blue"
            ? "border-blue-200 bg-blue-50 text-blue-900"
            : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-sm opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

export function FinanceDashboardClient({ schoolId }: { schoolId: string }) {
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(`/api/finance/dashboard?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load finance dashboard.");
      }

      setDashboard(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load finance dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Finance Overview
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Student billing, payments, invoices, and balances.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!dashboard && !error ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading finance dashboard...
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard
              label="Total invoiced"
              value={money(dashboard.totals.totalInvoiced)}
              tone="blue"
            />
            <KpiCard
              label="Total paid"
              value={money(dashboard.totals.totalPaid)}
              tone="green"
            />
            <KpiCard
              label="Balance due"
              value={money(dashboard.totals.totalBalanceDue)}
              tone={dashboard.totals.totalBalanceDue > 0 ? "amber" : "green"}
            />
            <KpiCard label="Payments" value={dashboard.totals.paymentCount} />
            <KpiCard label="Invoices" value={dashboard.totals.invoiceCount} />
            <KpiCard
              label="Unpaid invoices"
              value={dashboard.totals.unpaidInvoiceCount}
              tone={dashboard.totals.unpaidInvoiceCount > 0 ? "red" : "green"}
            />
            <KpiCard
              label="Paid invoices"
              value={dashboard.totals.paidInvoiceCount}
              tone="green"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">Recent Invoices</h3>

              <div className="mt-4 space-y-3">
                {dashboard.recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/finance/invoices/${invoice.id}`}
                          className="font-semibold text-slate-900 underline-offset-4 hover:underline"
                        >
                          {invoice.invoiceNumber ?? "Invoice"}
                        </Link>

                        <div className="mt-1 text-sm text-slate-600">
                          {invoice.invoiceTitle ?? "School invoice"}
                        </div>

                        <Link
                          href={`/students/${invoice.student.id}`}
                          className="mt-1 block text-xs text-slate-500 underline-offset-4 hover:underline"
                        >
                          {invoice.student.firstName} {invoice.student.lastName}
                          {invoice.student.studentCode
                            ? ` - ${invoice.student.studentCode}`
                            : ""}
                        </Link>
                      </div>

                      <SchoolBadge tone={invoiceTone(invoice.invoiceStatus)}>
                        {invoiceLabel(invoice.invoiceStatus)}
                      </SchoolBadge>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                      <div>
                        <div className="text-slate-500">Total</div>
                        <div className="font-semibold">
                          {money(invoice.totalAmount, invoice.currencyCode)}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-500">Paid</div>
                        <div className="font-semibold">
                          {money(invoice.paidAmount, invoice.currencyCode)}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-500">Balance</div>
                        <div className="font-semibold">
                          {money(invoice.balanceDue, invoice.currencyCode)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/finance/invoices/${invoice.id}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"
                      >
                        Open
                      </Link>

                      <Link
                        href={`/finance/invoices/${invoice.id}/thermal?autoprint=1`}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Print 80mm
                      </Link>
                    </div>
                  </div>
                ))}

                {dashboard.recentInvoices.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    No invoices yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">Recent Payments</h3>

              <div className="mt-4 space-y-3">
                {dashboard.recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/finance/payments/${payment.id}/receipt`}
                          className="font-semibold text-slate-900 underline-offset-4 hover:underline"
                        >
                          {payment.paymentNumber ?? "Payment"}
                        </Link>

                        <Link
                          href={`/students/${payment.student.id}`}
                          className="mt-1 block text-xs text-slate-500 underline-offset-4 hover:underline"
                        >
                          {payment.student.firstName} {payment.student.lastName}
                          {payment.student.studentCode
                            ? ` - ${payment.student.studentCode}`
                            : ""}
                        </Link>

                        <div className="mt-1 text-xs text-slate-500">
                          {payment.paidAt
                            ? new Date(payment.paidAt).toLocaleString()
                            : "-"}
                          {payment.paymentMethod
                            ? ` - ${payment.paymentMethod}`
                            : ""}
                        </div>
                      </div>

                      <SchoolBadge tone={paymentTone(payment.paymentStatus)}>
                        {payment.paymentStatus}
                      </SchoolBadge>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span>Amount</span>
                      <span className="font-semibold">
                        {money(payment.amount, payment.currencyCode)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/finance/payments/${payment.id}/receipt`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"
                      >
                        Receipt
                      </Link>

                      <Link
                        href={`/finance/payments/${payment.id}/receipt/thermal?autoprint=1`}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Print 80mm
                      </Link>
                    </div>
                  </div>
                ))}

                {dashboard.recentPayments.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    No payments yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}