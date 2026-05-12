"use client";

import { useEffect, useState } from "react";
import { FinanceInvoiceCreateClient } from "@/components/finance-invoice-create-client";
import { FinanceSettingsClient } from "@/components/finance-settings-client";
import { FinancePaymentRecorderClient } from "@/components/finance-payment-recorder-client";
import { SchoolBadge } from "@/components/school-ui";
import { StudentFinanceProfileClient } from "@/components/student-finance-profile-client";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type FinanceOverview = {
  schoolId: string;
  invoices: {
    total: number;
    draft: number;
    issued: number;
    partiallyPaid: number;
    paid: number;
    overdue: number;
    void: number;
  };
  money: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
  };
  payments: {
    confirmedPayments: number;
    confirmedAmount: number;
    lastPaymentAt: string | null;
  };
  aging: {
    current: number;
    days1To30: number;
    days31To60: number;
    days61Plus: number;
  };
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string | null;
  invoiceStatus: string;
  issueDate: string;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  currencyCode: string;
  student: {
    id: string;
    code: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  daysOverdue: number | null;
  createdAt: string;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function statusTone(status: string): BadgeTone {
  if (status === "PAID") return "green";
  if (status === "OVERDUE") return "red";
  if (status === "PARTIALLY_PAID") return "amber";
  if (status === "VOID") return "neutral";
  return "blue";
}

export function FinanceOverviewClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview() {
    if (!schoolId) return;

    setLoadingOverview(true);
    setError("");

    try {
      const res = await fetch(`/api/finance/overview?schoolId=${schoolId}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load finance overview.");
      }

      setOverview(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load finance overview.",
      );
    } finally {
      setLoadingOverview(false);
    }
  }

  async function loadInvoices() {
    if (!schoolId) return;

    setLoadingInvoices(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      if (status) {
        params.set("status", status);
      }

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const res = await fetch(`/api/finance/invoices?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load invoices.");
      }

      setInvoices(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices.");
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadOverview(), loadInvoices()]);
  }

  useEffect(() => {
    refreshAll();
  }, [schoolId]);

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Finance Overview
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Review invoices, outstanding balances, payments, and overdue exposure.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshAll}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loadingOverview ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading finance overview...
        </div>
      ) : null}

      <FinanceSettingsClient schoolId={schoolId} />

      <FinanceInvoiceCreateClient schoolId={schoolId} onCreated={refreshAll} />

      <StudentFinanceProfileClient schoolId={schoolId} />

      {overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Total Billed</div>
              <div className="mt-2 text-2xl font-bold">
                {money(overview.money.totalBilled)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Paid</div>
              <div className="mt-2 text-2xl font-bold">
                {money(overview.money.totalPaid)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Outstanding</div>
              <div className="mt-2 text-2xl font-bold">
                {money(overview.money.totalOutstanding)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Invoices</div>
              <div className="mt-2 text-2xl font-bold">
                {overview.invoices.total}
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm text-red-700">Overdue</div>
              <div className="mt-2 text-2xl font-bold text-red-900">
                {overview.invoices.overdue}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Payments</div>
              <div className="mt-2 text-2xl font-bold">
                {overview.payments.confirmedPayments}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Current</div>
              <div className="mt-2 text-xl font-bold">
                {money(overview.aging.current)}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm text-amber-700">1 - 30 days</div>
              <div className="mt-2 text-xl font-bold text-amber-900">
                {money(overview.aging.days1To30)}
              </div>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <div className="text-sm text-orange-700">31 - 60 days</div>
              <div className="mt-2 text-xl font-bold text-orange-900">
                {money(overview.aging.days31To60)}
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm text-red-700">61+ days</div>
              <div className="mt-2 text-xl font-bold text-red-900">
                {money(overview.aging.days61Plus)}
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="border-t border-slate-200 pt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold text-slate-900">Invoice Visibility</h4>
            <p className="mt-1 text-sm text-slate-600">
              Review current invoices and collection exposure.
            </p>
          </div>

          <button
            type="button"
            onClick={loadInvoices}
            disabled={loadingInvoices}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingInvoices ? "Loading..." : "Load Invoices"}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="VOID">Void</option>
          </select>

          <input
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search student or invoice"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Issued: {invoice.issueDate}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {invoice.student ? (
                      <>
                        <div className="font-medium text-slate-900">
                          {invoice.student.firstName ?? ""}{" "}
                          {invoice.student.lastName ?? ""}
                        </div>
                        <div className="text-xs text-slate-500">
                          {invoice.student.code ?? "No student code"}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500">No student</span>
                    )}
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

                  <td className="px-4 py-3 align-top">
                    <div className="space-y-2">
                      <a
                        href={`/finance/invoices/${invoice.id}`}
                        className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Open Invoice
                      </a>

                      <FinancePaymentRecorderClient
                        schoolId={schoolId}
                        invoice={invoice}
                        onPaymentRecorded={refreshAll}
                      />
                    </div>
                  </td>
                </tr>
              ))}

              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No invoices loaded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
