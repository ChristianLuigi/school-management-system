"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FinanceInvoiceStatusActionsClient } from "@/components/finance-invoice-status-actions-client";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type InvoiceDetails = {
  id: string;
  school: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    financeSettings?: {
      financeContactName: string | null;
      financeContactEmail: string | null;
      financeContactPhone: string | null;
      invoiceFooterI18n: Record<string, string>;
    };
  };
  student: {
    id: string;
    code: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
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
  createdAt: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitAmount: number;
    lineTotal: number;
  }>;
  payments: Array<{
    id: string;
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

export function FinanceInvoiceDetailClient({
  schoolId,
  invoiceId,
}: {
  schoolId: string;
  invoiceId: string;
}) {
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadInvoice() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/invoices/${invoiceId}?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load invoice.");
      }

      setInvoice(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, invoiceId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back to Finance
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Print / Save as PDF
          </button>

          <Link
            href={`/finance/invoices/${invoiceId}/thermal`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Thermal 80mm
          </Link>

          <Link
            href={`/finance/invoices/${invoiceId}/thermal?autoprint=1`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Quick 80mm Print
          </Link>
        </div>

        <button
          type="button"
          onClick={loadInvoice}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 print:hidden">
          Loading invoice...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      ) : null}

      {invoice ? (
        <div className="space-y-6">
          <FinanceInvoiceStatusActionsClient
            schoolId={schoolId}
            invoiceId={invoice.id}
            invoiceStatus={invoice.invoiceStatus}
            amountPaid={invoice.amountPaid}
            onChanged={loadInvoice}
          />

          <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <div className="border-b border-slate-200 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                  Invoice
                </div>

                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                  {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                </h1>

                <div className="mt-1 text-sm text-slate-500">
                  {invoice.school.name} - {invoice.school.code}
                </div>

                <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                  {invoice.school.addressLine1 ? <div>{invoice.school.addressLine1}</div> : null}
                  {invoice.school.addressLine2 ? <div>{invoice.school.addressLine2}</div> : null}
                  {invoice.school.city ? <div>{invoice.school.city}</div> : null}

                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {invoice.school.phone ? <span>{invoice.school.phone}</span> : null}
                    {invoice.school.email ? <span>{invoice.school.email}</span> : null}
                    {invoice.school.website ? <span>{invoice.school.website}</span> : null}
                  </div>

                  {invoice.school.financeSettings?.financeContactName ||
                  invoice.school.financeSettings?.financeContactEmail ||
                  invoice.school.financeSettings?.financeContactPhone ? (
                    <div className="pt-2">
                      Finance contact:{" "}
                      {invoice.school.financeSettings.financeContactName ?? ""}
                      {invoice.school.financeSettings.financeContactPhone
                        ? ` - ${invoice.school.financeSettings.financeContactPhone}`
                        : ""}
                      {invoice.school.financeSettings.financeContactEmail
                        ? ` - ${invoice.school.financeSettings.financeContactEmail}`
                        : ""}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="text-right">
                <SchoolBadge tone={statusTone(invoice.invoiceStatus)}>
                  {invoice.invoiceStatus}
                </SchoolBadge>

                <div className="mt-3 text-sm text-slate-500">
                  Issue date: {invoice.issueDate}
                </div>

                <div className="text-sm text-slate-500">
                  Due date: {invoice.dueDate ?? "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-b border-slate-200 py-6 md:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Bill To
              </div>

              <div className="mt-1 text-xl font-bold text-slate-900">
                {invoice.student
                  ? `${invoice.student.firstName ?? ""} ${invoice.student.lastName ?? ""}`
                  : "No student"}
              </div>

              {invoice.student ? (
                <div className="mt-1 text-sm text-slate-500">
                  {invoice.student.code ?? "Code pending"}
                </div>
              ) : null}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Invoice ID
              </div>

              <div className="mt-1 break-all text-sm font-medium text-slate-900">
                {invoice.id}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Currency
              </div>

              <div className="mt-1 text-xl font-bold text-slate-900">
                {invoice.currencyCode}
              </div>
            </div>
          </div>

          <div className="grid gap-4 py-6 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 print:bg-white">
              <div className="text-sm text-slate-500">Subtotal</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {money(invoice.subtotalAmount, invoice.currencyCode)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 print:bg-white">
              <div className="text-sm text-slate-500">Discount</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {money(invoice.discountAmount, invoice.currencyCode)}
              </div>
            </div>

            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 print:bg-white">
              <div className="text-sm text-green-700">Paid</div>
              <div className="mt-2 text-2xl font-bold text-green-900">
                {money(invoice.amountPaid, invoice.currencyCode)}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 print:bg-white">
              <div className="text-sm text-amber-700">Balance</div>
              <div className="mt-2 text-2xl font-bold text-amber-900">
                {money(invoice.balanceDue, invoice.currencyCode)}
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Invoice Items
            </h2>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600 print:bg-white">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Unit Amount</th>
                    <th className="px-4 py-3">Line Total</th>
                  </tr>
                </thead>

                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.description}
                      </td>
                      <td className="px-4 py-3">{item.quantity}</td>
                      <td className="px-4 py-3">
                        {money(item.unitAmount, invoice.currencyCode)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {money(item.lineTotal, invoice.currencyCode)}
                      </td>
                    </tr>
                  ))}

                  {invoice.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No invoice items found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Totals</h2>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-900">
                  {money(invoice.subtotalAmount, invoice.currencyCode)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Discount</span>
                <span className="font-medium text-slate-900">
                  {money(invoice.discountAmount, invoice.currencyCode)}
                </span>
              </div>

              <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="font-bold text-slate-900">
                  {money(invoice.totalAmount, invoice.currencyCode)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-medium text-green-700">
                  {money(invoice.amountPaid, invoice.currencyCode)}
                </span>
              </div>

              <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-lg">
                <span className="font-bold text-slate-900">Balance Due</span>
                <span className="font-bold text-amber-800">
                  {money(invoice.balanceDue, invoice.currencyCode)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Payment History
            </h2>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600 print:bg-white">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Receipt</th>
                  </tr>
                </thead>

                <tbody>
                  {invoice.payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{payment.paymentDate}</td>
                      <td className="px-4 py-3">
                        <SchoolBadge tone={statusTone(payment.paymentStatus)}>
                          {payment.paymentStatus}
                        </SchoolBadge>
                      </td>
                      <td className="px-4 py-3">{payment.method ?? "-"}</td>
                      <td className="px-4 py-3">{payment.reference ?? "-"}</td>
                      <td className="px-4 py-3 font-semibold">
                        {money(payment.amount, invoice.currencyCode)}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/finance/payments/${payment.id}/receipt`}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          Receipt
                        </a>

                        <a
                          href={`/finance/payments/${payment.id}/receipt/thermal`}
                          className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50 print:hidden"
                        >
                          80mm
                        </a>
                      </td>
                    </tr>
                  ))}

                  {invoice.payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No payments recorded for this invoice.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {invoice.notes ? (
            <div className="mt-8 rounded-2xl border border-slate-200 p-5">
              <div className="text-sm font-semibold text-slate-900">Notes</div>
              <p className="mt-2 text-sm text-slate-600">{invoice.notes}</p>
            </div>
          ) : null}

          <div className="mt-10 grid gap-8 border-t border-slate-200 pt-10 md:grid-cols-2">
            <div className="h-24 border-t border-slate-300 pt-2 text-center text-sm text-slate-500">
              Finance Officer
            </div>

            <div className="h-24 border-t border-slate-300 pt-2 text-center text-sm text-slate-500">
              Parent / Guardian
            </div>
          </div>
          {invoice.school.financeSettings?.invoiceFooterI18n?.en ||
          invoice.school.financeSettings?.invoiceFooterI18n?.fr ? (
            <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
              {invoice.school.financeSettings.invoiceFooterI18n.en ??
                invoice.school.financeSettings.invoiceFooterI18n.fr}
            </div>
          ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
