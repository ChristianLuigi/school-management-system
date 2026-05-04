"use client";

import { useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type InvoiceRow = {
  id: string;
  invoiceNumber: string | null;
  invoiceStatus: string;
  balanceDue: number;
  currencyCode: string;
  student: {
    id: string;
    code: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

type PaymentRow = {
  id: string;
  paymentStatus: string;
  paymentDate: string;
  amount: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

export function FinancePaymentRecorderClient({
  schoolId,
  invoice,
  onPaymentRecorded,
}: {
  schoolId: string;
  invoice: InvoiceRow;
  onPaymentRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [amount, setAmount] = useState(invoice.balanceDue.toString());
  const [paymentDate, setPaymentDate] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPayments() {
    setLoadingPayments(true);
    setError("");

    try {
      const res = await fetch(
        `/api/finance/invoices/${invoice.id}/payments?schoolId=${schoolId}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load payments.");
      }

      setPayments(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments.");
    } finally {
      setLoadingPayments(false);
    }
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);

    if (next) {
      await loadPayments();
    }
  }

  async function recordPayment() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const numericAmount = Number(amount);

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error("Enter a valid payment amount.");
      }

      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          invoiceId: invoice.id,
          amount: numericAmount,
          paymentDate: paymentDate || undefined,
          method,
          reference,
          notes,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to record payment.");
      }

      setMessage("Payment recorded successfully.");
      setAmount("");
      setReference("");
      setNotes("");

      await loadPayments();
      onPaymentRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggleOpen}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50"
      >
        {open ? "Close Payments" : "Payments"}
      </button>

      {open ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Record Payment
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Balance: {money(invoice.balanceDue, invoice.currencyCode)}
              </div>
            </div>

            <SchoolBadge>{invoice.invoiceStatus}</SchoolBadge>
          </div>

          {message ? (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {invoice.invoiceStatus === "PAID" || invoice.invoiceStatus === "VOID" ? (
            <div className="mt-4 rounded-xl bg-white p-3 text-sm text-slate-600">
              Payments cannot be recorded because this invoice is {invoice.invoiceStatus}.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              <input
                type="date"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />

              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="">Payment method</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHECK">Check</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>

              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />

              <textarea
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <button
                type="button"
                disabled={saving}
                onClick={recordPayment}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Record Payment"}
              </button>
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                Payment History
              </div>

              <button
                type="button"
                onClick={loadPayments}
                disabled={loadingPayments}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-white disabled:opacity-60"
              >
                {loadingPayments ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="space-y-2">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="font-medium text-slate-900">
                      {money(payment.amount, invoice.currencyCode)}
                    </div>
                    <SchoolBadge>{payment.paymentStatus}</SchoolBadge>
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {payment.paymentDate}
                    {payment.method ? ` · ${payment.method}` : ""}
                    {payment.reference ? ` · Ref: ${payment.reference}` : ""}
                  </div>

                  {payment.notes ? (
                    <div className="mt-1 text-xs text-slate-600">
                      {payment.notes}
                    </div>
                  ) : null}
                </div>
              ))}

              {payments.length === 0 ? (
                <div className="rounded-xl bg-white p-3 text-sm text-slate-500">
                  No payments recorded yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
