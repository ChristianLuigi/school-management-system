"use client";

import { useState } from "react";

type InvoiceItem = {
  description: string;
  quantity: string;
  unitAmount: string;
};

function emptyItem(): InvoiceItem {
  return {
    description: "",
    quantity: "1",
    unitAmount: "0",
  };
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

export function FinanceInvoiceCreateClient({
  schoolId,
  onCreated,
}: {
  schoolId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<"DRAFT" | "ISSUED">(
    "ISSUED",
  );
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unitAmount = Number(item.unitAmount);

    if (!Number.isFinite(quantity) || !Number.isFinite(unitAmount)) {
      return sum;
    }

    return sum + quantity * unitAmount;
  }, 0);

  const discount = Number(discountAmount) || 0;
  const total = Math.max(subtotal - discount, 0);

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function createInvoice() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!studentId.trim()) {
        throw new Error("Student ID is required.");
      }

      const cleanItems = items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unitAmount: Number(item.unitAmount),
      }));

      if (cleanItems.some((item) => !item.description)) {
        throw new Error("Each invoice item must have a description.");
      }

      if (
        cleanItems.some(
          (item) => !Number.isFinite(item.quantity) || item.quantity <= 0,
        )
      ) {
        throw new Error("Each invoice item must have a valid quantity.");
      }

      if (
        cleanItems.some(
          (item) => !Number.isFinite(item.unitAmount) || item.unitAmount < 0,
        )
      ) {
        throw new Error("Each invoice item must have a valid unit amount.");
      }

      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          studentId: studentId.trim(),
          invoiceStatus,
          issueDate: issueDate || undefined,
          dueDate: dueDate || undefined,
          discountAmount: Number(discountAmount) || 0,
          currencyCode,
          notes,
          items: cleanItems,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create invoice.");
      }

      setMessage(`Invoice created successfully: ${body.invoiceNumber}`);
      setStudentId("");
      setInvoiceStatus("ISSUED");
      setIssueDate("");
      setDueDate("");
      setDiscountAmount("0");
      setNotes("");
      setItems([emptyItem()]);
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
            Create a draft or issued invoice for a student.
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
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />

            <select
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={invoiceStatus}
              onChange={(e) =>
                setInvoiceStatus(e.target.value as "DRAFT" | "ISSUED")
              }
            >
              <option value="ISSUED">Issued</option>
              <option value="DRAFT">Draft</option>
            </select>

            <select
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
            >
              <option value="USD">USD</option>
              <option value="HTG">HTG</option>
            </select>

            <input
              type="date"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />

            <input
              type="date"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Discount amount"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />

            <textarea
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="font-semibold text-slate-900">Invoice Items</div>

              <button
                type="button"
                onClick={addItem}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              >
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const lineTotal =
                  (Number(item.quantity) || 0) * (Number(item.unitAmount) || 0);

                return (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_120px_140px_140px_auto]"
                  >
                    <input
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, { description: e.target.value })
                      }
                    />

                    <input
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, { quantity: e.target.value })
                      }
                    />

                    <input
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Unit amount"
                      value={item.unitAmount}
                      onChange={(e) =>
                        updateItem(index, { unitAmount: e.target.value })
                      }
                    />

                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold">
                      {money(lineTotal, currencyCode)}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Subtotal</div>
              <div className="mt-2 text-2xl font-bold">
                {money(subtotal, currencyCode)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Discount</div>
              <div className="mt-2 text-2xl font-bold">
                {money(discount, currencyCode)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-900 bg-slate-900 p-4 text-white">
              <div className="text-sm text-slate-300">Total</div>
              <div className="mt-2 text-2xl font-bold">
                {money(total, currencyCode)}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={createInvoice}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Invoice"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
