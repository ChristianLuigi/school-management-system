"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";

type PaymentReceipt = {
  id: string;
  receiptNumber: string;
  receiptGeneratedAt: string | null;
  paymentStatus: string;
  paymentDate: string;
  amount: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  school: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string | null;
    invoiceStatus: string | null;
    currencyCode: string;
    totalAmount: number | null;
    amountPaid: number | null;
    balanceDue: number | null;
  } | null;
  student: {
    id: string;
    code: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function statusTone(status: string): BadgeTone {
  if (status === "CONFIRMED" || status === "PAID") return "green";
  if (status === "CANCELLED" || status === "REFUNDED") return "red";
  return "blue";
}

export function FinancePaymentReceiptClient({
  schoolId,
  paymentId,
}: {
  schoolId: string;
  paymentId: string;
}) {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReceipt() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/payments/${paymentId}/receipt?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load payment receipt.");
      }

      setReceipt(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load payment receipt.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, paymentId]);

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
        </div>

        <button
          type="button"
          onClick={loadReceipt}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 print:hidden">
          Loading receipt...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      ) : null}

      {receipt ? (
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="border-b border-slate-200 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {receipt.school.logoUrl ? (
                  <img
                    src={receipt.school.logoUrl}
                    alt={receipt.school.name}
                    className="h-20 w-20 rounded-2xl object-contain"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xl font-bold text-slate-400">
                    {receipt.school.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                    Payment Receipt
                  </div>

                  <h1 className="mt-2 text-3xl font-bold text-slate-900">
                    {receipt.school.name}
                  </h1>

                  <div className="mt-1 text-sm text-slate-500">
                    Code: {receipt.school.code}
                  </div>

                  <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                    {receipt.school.addressLine1 ? (
                      <div>{receipt.school.addressLine1}</div>
                    ) : null}
                    {receipt.school.addressLine2 ? (
                      <div>{receipt.school.addressLine2}</div>
                    ) : null}
                    {receipt.school.city ? <div>{receipt.school.city}</div> : null}

                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {receipt.school.phone ? <span>{receipt.school.phone}</span> : null}
                      {receipt.school.email ? <span>{receipt.school.email}</span> : null}
                      {receipt.school.website ? <span>{receipt.school.website}</span> : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <SchoolBadge tone={statusTone(receipt.paymentStatus)}>
                  {receipt.paymentStatus}
                </SchoolBadge>

                <div className="mt-3 text-sm text-slate-500">
                  Payment date: {receipt.paymentDate}
                </div>

                <div className="text-sm text-slate-500">
                  Receipt: {receipt.receiptNumber}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-b border-slate-200 py-6 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Received From
              </div>

              <div className="mt-1 text-xl font-bold text-slate-900">
                {receipt.student
                  ? `${receipt.student.firstName ?? ""} ${receipt.student.lastName ?? ""}`
                  : "Unknown payer"}
              </div>

              {receipt.student ? (
                <div className="mt-1 text-sm text-slate-500">
                  {receipt.student.code ?? receipt.student.id}
                </div>
              ) : null}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Invoice
              </div>

              <div className="mt-1 text-xl font-bold text-slate-900">
                {receipt.invoice?.invoiceNumber ?? receipt.invoice?.id ?? "-"}
              </div>

              {receipt.invoice ? (
                <div className="mt-1 text-sm text-slate-500">
                  Status: {receipt.invoice.invoiceStatus ?? "-"}
                </div>
              ) : null}
            </div>
          </div>

          <div className="py-8 text-center">
            <div className="text-sm uppercase tracking-wider text-slate-500">
              Amount Received
            </div>

            <div className="mt-3 text-5xl font-bold text-slate-900">
              {money(receipt.amount, receipt.invoice?.currencyCode ?? "USD")}
            </div>

            <div className="mt-2 text-sm text-slate-500">
              Method: {receipt.method ?? "-"}
              {receipt.reference ? ` - Reference: ${receipt.reference}` : ""}
            </div>
          </div>

          {receipt.invoice ? (
            <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 print:bg-white">
                <div className="text-sm text-slate-500">Invoice Total</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {receipt.invoice.totalAmount === null
                    ? "-"
                    : money(receipt.invoice.totalAmount, receipt.invoice.currencyCode)}
                </div>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 print:bg-white">
                <div className="text-sm text-green-700">Total Paid</div>
                <div className="mt-2 text-xl font-bold text-green-900">
                  {receipt.invoice.amountPaid === null
                    ? "-"
                    : money(receipt.invoice.amountPaid, receipt.invoice.currencyCode)}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 print:bg-white">
                <div className="text-sm text-amber-700">Remaining Balance</div>
                <div className="mt-2 text-xl font-bold text-amber-900">
                  {receipt.invoice.balanceDue === null
                    ? "-"
                    : money(receipt.invoice.balanceDue, receipt.invoice.currencyCode)}
                </div>
              </div>
            </div>
          ) : null}

          {receipt.notes ? (
            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="text-sm font-semibold text-slate-900">Notes</div>
              <p className="mt-2 text-sm text-slate-600">{receipt.notes}</p>
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

          <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
            This receipt confirms the payment recorded in the school management system.
          </div>
        </div>
      ) : null}
    </div>
  );
}
