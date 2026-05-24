"use client";

import { useState } from "react";

export function StudentCreateInvoicePanelClient({
  schoolId,
  studentId,
  onCreated,
}: {
  schoolId: string;
  studentId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [invoiceTitle, setInvoiceTitle] = useState("Frais de scolarité");
  const [totalAmount, setTotalAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<"ISSUED" | "DRAFT">(
    "ISSUED",
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createInvoice() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const amount = Number(totalAmount);

      if (!invoiceTitle.trim()) {
        throw new Error("Invoice title is required.");
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invoice amount must be greater than zero.");
      }

      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          studentId,
          invoiceTitle,
          totalAmount: amount,
          currencyCode,
          issueDate: issueDate || undefined,
          dueDate: dueDate || undefined,
          invoiceStatus,
          notes,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create invoice.");
      }

      setMessage(`Invoice ${body.invoiceNumber ?? ""} created successfully.`);
      setOpen(false);
      setInvoiceTitle("Frais de scolarité");
      setTotalAmount("");
      setCurrencyCode("USD");
      setIssueDate("");
      setDueDate("");
      setInvoiceStatus("ISSUED");
      setNotes("");

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Create Invoice
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Create a manual invoice for this student.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          {open ? "Close" : "New Invoice"}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {open ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="Invoice title"
              value={invoiceTitle}
              onChange={(event) => setInvoiceTitle(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Amount"
              value={totalAmount}
              onChange={(event) => setTotalAmount(event.target.value)}
            />

            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value)}
            >
              <option value="USD">USD</option>
              <option value="HTG">HTG</option>
            </select>

            <input
              type="date"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
            />

            <input
              type="date"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />

            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              value={invoiceStatus}
              onChange={(event) =>
                setInvoiceStatus(event.target.value as "ISSUED" | "DRAFT")
              }
            >
              <option value="ISSUED">Issue invoice</option>
              <option value="DRAFT">Save as draft</option>
            </select>
          </div>

          <textarea
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Notes optional"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <button
            type="button"
            disabled={saving}
            onClick={createInvoice}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create Invoice"}
          </button>
        </div>
      ) : null}
    </div>
  );
}