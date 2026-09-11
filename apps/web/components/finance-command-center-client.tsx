"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Banknote,
  FileText,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
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
    invoice: { id: string; invoiceNumber: string | null } | null;
    student: {
      id: string;
      studentCode: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  }>;
};

function invoiceTone(status: string): BadgeTone {
  if (status === "PAID") return "green";
  if (status === "PARTIALLY_PAID") return "amber";
  if (["OVERDUE", "VOID", "CANCELLED"].includes(status)) return "red";
  return "blue";
}

function paymentTone(status: string): BadgeTone {
  if (["CONFIRMED", "PAID", "RECORDED"].includes(status)) return "green";
  if (status === "PENDING") return "amber";
  if (["CANCELLED", "REVERSED"].includes(status)) return "red";
  return "blue";
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: "blue" | "green" | "amber" | "red" | "slate";
}) {
  const iconClass = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`shrink-0 rounded-xl p-3 ${iconClass}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-xl font-bold text-slate-950">{value}</div>
        <div className="truncate text-sm text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export function FinanceCommandCenterClient({ schoolId }: { schoolId: string }) {
  const { locale, t } = useI18n();
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const localeCode = locale === "fr" ? "fr-HT" : "en-US";

  const money = (value: number, currency = "USD") =>
    new Intl.NumberFormat(localeCode, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);

  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(localeCode, { dateStyle: "medium" }).format(
          new Date(value),
        )
      : "—";

  const statusLabel = (status: string) => {
    const translated = t(`finance.statuses.${status}`);
    return translated === `finance.statuses.${status}`
      ? status.replaceAll("_", " ")
      : translated;
  };

  const studentName = (student: FinanceDashboard["recentInvoices"][number]["student"]) =>
    [student.firstName, student.lastName].filter(Boolean).join(" ") ||
    student.studentCode ||
    "—";

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });
      const response = await fetch(
        `/api/finance/dashboard?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message ?? t("finance.loadFailed"));
      }

      setDashboard(body);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("finance.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, t]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance/cashier"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Banknote className="h-4 w-4" aria-hidden="true" />
            {t("finance.collectPayment")}
          </Link>
          <Link
            href="/finance/billing"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          >
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
            {t("finance.runBilling")}
          </Link>
          <Link
            href="/finance/corrections"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t("finance.corrections")}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={loading}
          title={t("common.refresh")}
          aria-label={t("common.refresh")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <span className="flex items-center gap-2 text-sm font-medium">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white"
          >
            {t("finance.retry")}
          </button>
        </div>
      ) : null}

      {!dashboard && loading ? (
        <div className="grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dashboard.moneyByCurrency.flatMap((totals) => [
              <KpiCard
                key={`${totals.currencyCode}-invoiced`}
                icon={ReceiptText}
                label={`${t("finance.totalInvoiced")} · ${totals.currencyCode}`}
                value={money(totals.totalInvoiced, totals.currencyCode)}
                tone="blue"
              />,
              <KpiCard
                key={`${totals.currencyCode}-paid`}
                icon={Banknote}
                label={`${t("finance.totalCollected")} · ${totals.currencyCode}`}
                value={money(totals.totalPaid, totals.currencyCode)}
                tone="green"
              />,
              <KpiCard
                key={`${totals.currencyCode}-balance`}
                icon={WalletCards}
                label={`${t("finance.outstanding")} · ${totals.currencyCode}`}
                value={money(totals.totalBalanceDue, totals.currencyCode)}
                tone={totals.totalBalanceDue > 0 ? "amber" : "green"}
              />,
            ])}
            <KpiCard
              icon={FileText}
              label={t("finance.unpaidInvoices")}
              value={dashboard.totals.unpaidInvoiceCount}
              tone={dashboard.totals.unpaidInvoiceCount > 0 ? "red" : "green"}
            />
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              {t("finance.invoices")}: <strong>{dashboard.totals.invoiceCount}</strong>
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
              {t("finance.paid")}: <strong>{dashboard.totals.paidInvoiceCount}</strong>
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
              {t("finance.payments")}: <strong>{dashboard.totals.paymentCount}</strong>
            </span>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
                    <ReceiptText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-semibold text-slate-950">
                    {t("finance.recentInvoices")}
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {dashboard.recentInvoices.length}
                </span>
              </header>
              <div className="divide-y divide-slate-100">
                {dashboard.recentInvoices.map((invoice) => (
                  <article key={invoice.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/finance/invoices/${invoice.id}`} className="truncate font-semibold text-slate-950 hover:text-blue-700">
                            {invoice.invoiceNumber ?? t("finance.invoice")}
                          </Link>
                          <SchoolBadge tone={invoiceTone(invoice.invoiceStatus)}>
                            {statusLabel(invoice.invoiceStatus)}
                          </SchoolBadge>
                        </div>
                        <Link href={`/students/${invoice.student.id}`} className="mt-1 block truncate text-sm text-slate-500 hover:text-blue-700">
                          {studentName(invoice.student)}
                          {invoice.student.studentCode ? ` · ${invoice.student.studentCode}` : ""}
                        </Link>
                        <div className="mt-1 text-xs text-slate-400">
                          {date(invoice.issueDate ?? invoice.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-950">
                          {money(invoice.totalAmount, invoice.currencyCode)}
                        </div>
                        {invoice.balanceDue > 0 ? (
                          <div className="mt-1 text-xs font-medium text-amber-700">
                            {t("finance.balance")}: {money(invoice.balanceDue, invoice.currencyCode)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2 print:hidden">
                      <Link href={`/finance/invoices/${invoice.id}`} title={t("finance.open")} aria-label={t("finance.open")} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-700">
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <Link href={`/finance/invoices/${invoice.id}/thermal?autoprint=1`} title={t("finance.thermalPrint")} aria-label={t("finance.thermalPrint")} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-700">
                        <Printer className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                ))}
                {!dashboard.recentInvoices.length ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    {t("finance.noInvoices")}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                    <Banknote className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-semibold text-slate-950">
                    {t("finance.recentPayments")}
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {dashboard.recentPayments.length}
                </span>
              </header>
              <div className="divide-y divide-slate-100">
                {dashboard.recentPayments.map((payment) => (
                  <article key={payment.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/finance/payments/${payment.id}/receipt`} className="truncate font-semibold text-slate-950 hover:text-blue-700">
                            {payment.paymentNumber ?? t("finance.payment")}
                          </Link>
                          <SchoolBadge tone={paymentTone(payment.paymentStatus)}>
                            {statusLabel(payment.paymentStatus)}
                          </SchoolBadge>
                        </div>
                        <Link href={`/students/${payment.student.id}`} className="mt-1 block truncate text-sm text-slate-500 hover:text-blue-700">
                          {studentName(payment.student)}
                          {payment.student.studentCode ? ` · ${payment.student.studentCode}` : ""}
                        </Link>
                        <div className="mt-1 text-xs text-slate-400">
                          {[date(payment.paidAt ?? payment.createdAt), payment.paymentMethod]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <div className="text-right font-bold text-slate-950">
                        {money(payment.amount, payment.currencyCode)}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2 print:hidden">
                      <Link href={`/finance/payments/${payment.id}/receipt`} title={t("finance.printReceipt")} aria-label={t("finance.printReceipt")} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-700">
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <Link href={`/finance/payments/${payment.id}/receipt/thermal?autoprint=1`} title={t("finance.thermalPrint")} aria-label={t("finance.thermalPrint")} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-700">
                        <Printer className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                ))}
                {!dashboard.recentPayments.length ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    {t("finance.noPayments")}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
