"use client";

import { PaginatedCollection } from "@/components/paginated-collection";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type FinanceDashboard = {
  totals: {
    invoiceCount: number;
    unpaidInvoiceCount: number;
    paidInvoiceCount: number;
    paymentCount: number;
  };
  moneyByCurrency: Array<{
    currencyCode: string;
    totalInvoiced: number;
    totalPaid: number;
    totalBalanceDue: number;
  }>;
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
      ? "border-success/40 bg-success-subtle text-success"
      : tone === "amber"
        ? "border-warning/40 bg-warning-subtle text-warning"
        : tone === "red"
          ? "border-danger/40 bg-danger-subtle text-danger"
          : tone === "blue"
            ? "border-info/40 bg-info-subtle text-info"
            : "border-border bg-surface text-foreground";

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
          <h2 className="text-xl font-semibold text-foreground">
            Finance Overview
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Student billing, payments, invoices, and balances.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {!dashboard && !error ? (
        <div className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
          Loading finance dashboard...
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {dashboard.moneyByCurrency.flatMap((totals) => [
              <KpiCard
                key={`${totals.currencyCode}-invoiced`}
                label={`Total invoiced (${totals.currencyCode})`}
                value={money(totals.totalInvoiced, totals.currencyCode)}
                tone="blue"
              />,
              <KpiCard
                key={`${totals.currencyCode}-paid`}
                label={`Total paid (${totals.currencyCode})`}
                value={money(totals.totalPaid, totals.currencyCode)}
                tone="green"
              />,
              <KpiCard
                key={`${totals.currencyCode}-balance`}
                label={`Balance due (${totals.currencyCode})`}
                value={money(totals.totalBalanceDue, totals.currencyCode)}
                tone={totals.totalBalanceDue > 0 ? "amber" : "green"}
              />,
            ])}
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
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-semibold text-foreground">Recent Invoices</h3>

              <div className="mt-4 space-y-3">
                {<PaginatedCollection items={dashboard.recentInvoices}>{(invoice) => (
                  <div
                    key={invoice.id}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/finance/invoices/${invoice.id}`}
                          className="font-semibold text-foreground underline-offset-4 hover:underline"
                        >
                          {invoice.invoiceNumber ?? "Invoice"}
                        </Link>

                        <div className="mt-1 text-sm text-muted-foreground">
                          {invoice.invoiceTitle ?? "School invoice"}
                        </div>

                        <Link
                          href={`/students/${invoice.student.id}`}
                          className="mt-1 block text-xs text-muted-foreground underline-offset-4 hover:underline"
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
                        <div className="text-muted-foreground">Total</div>
                        <div className="font-semibold">
                          {money(invoice.totalAmount, invoice.currencyCode)}
                        </div>
                      </div>

                      <div>
                        <div className="text-muted-foreground">Paid</div>
                        <div className="font-semibold">
                          {money(invoice.paidAmount, invoice.currencyCode)}
                        </div>
                      </div>

                      <div>
                        <div className="text-muted-foreground">Balance</div>
                        <div className="font-semibold">
                          {money(invoice.balanceDue, invoice.currencyCode)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/finance/invoices/${invoice.id}`}
                        className="rounded-lg border border-input bg-surface px-3 py-2 text-xs font-medium hover:bg-surface"
                      >
                        Open
                      </Link>

                      <Link
                        href={`/finance/invoices/${invoice.id}/thermal?autoprint=1`}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary"
                      >
                        Print 80mm
                      </Link>
                    </div>
                  </div>
                )}</PaginatedCollection>}

                {dashboard.recentInvoices.length === 0 ? (
                  <div className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
                    No invoices yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-semibold text-foreground">Recent Payments</h3>

              <div className="mt-4 space-y-3">
                {<PaginatedCollection items={dashboard.recentPayments}>{(payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/finance/payments/${payment.id}/receipt`}
                          className="font-semibold text-foreground underline-offset-4 hover:underline"
                        >
                          {payment.paymentNumber ?? "Payment"}
                        </Link>

                        <Link
                          href={`/students/${payment.student.id}`}
                          className="mt-1 block text-xs text-muted-foreground underline-offset-4 hover:underline"
                        >
                          {payment.student.firstName} {payment.student.lastName}
                          {payment.student.studentCode
                            ? ` - ${payment.student.studentCode}`
                            : ""}
                        </Link>

                        <div className="mt-1 text-xs text-muted-foreground">
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
                        className="rounded-lg border border-input bg-surface px-3 py-2 text-xs font-medium hover:bg-surface"
                      >
                        Receipt
                      </Link>

                      <Link
                        href={`/finance/payments/${payment.id}/receipt/thermal?autoprint=1`}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary"
                      >
                        Print 80mm
                      </Link>
                    </div>
                  </div>
                )}</PaginatedCollection>}

                {dashboard.recentPayments.length === 0 ? (
                  <div className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
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
