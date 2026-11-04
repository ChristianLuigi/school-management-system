"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";
import { StudentSelectorClient } from "@/components/student-selector-client";
import type { SelectedStudent } from "@/components/student-selector-client";

type InvoiceItem = {
  description: string;
  quantity: string;
  unitAmount: string;
};

type FinanceSettings = {
  defaultCurrencyCode: string;
  defaultInvoiceDueDays: number;
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function FinanceInvoiceCreateClient({
  schoolId,
  onCreated,
}: {
  schoolId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<"DRAFT" | "ISSUED">(
    "ISSUED",
  );
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef("");
  const idempotencyPayloadRef = useRef("");

  const effectiveIssueDate = issueDate || todayIsoDate();

  const effectiveDueDate =
    dueDate ||
    addDays(
      effectiveIssueDate,
      settings?.defaultInvoiceDueDays ?? 30,
    );

  const cleanItems = useMemo(() => {
    return items.map((item) => {
      const quantity = Number(item.quantity);
      const unitAmount = Number(item.unitAmount);

      return {
        description: item.description.trim(),
        quantity,
        unitAmount,
        lineTotal:
          Number.isFinite(quantity) && Number.isFinite(unitAmount)
            ? Number((quantity * unitAmount).toFixed(2))
            : 0,
      };
    });
  }, [items]);

  const subtotal = cleanItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const discount = Number(discountAmount) || 0;
  const total = Math.max(subtotal - discount, 0);

  async function loadFinanceSettings() {
    setSettingsLoading(true);

    try {
      const res = await fetch(`/api/finance/settings?schoolId=${schoolId}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (res.ok && body) {
        setSettings({
          defaultCurrencyCode: body.defaultCurrencyCode ?? "USD",
          defaultInvoiceDueDays: body.defaultInvoiceDueDays ?? 30,
        });

        setCurrencyCode(body.defaultCurrencyCode ?? "USD");
      }
    } finally {
      setSettingsLoading(false);
    }
  }

  function validateInvoiceDraft() {
    if (!selectedStudent) {
      throw new Error("Please select a student.");
    }

    if (cleanItems.length === 0) {
      throw new Error("Invoice must contain at least one item.");
    }

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

    if (!Number.isFinite(discount) || discount < 0) {
      throw new Error("Discount must be a valid amount.");
    }

    if (discount > subtotal) {
      throw new Error("Discount cannot exceed subtotal.");
    }
  }

  function previewInvoice() {
    setMessage("");
    setError("");

    try {
      validateInvoiceDraft();
      setPreviewVisible(true);
    } catch (err) {
      setPreviewVisible(false);
      setError(err instanceof Error ? err.message : "Invoice preview failed.");
    }
  }

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setPreviewVisible(false);

    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function addItem() {
    setPreviewVisible(false);
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setPreviewVisible(false);

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
      validateInvoiceDraft();
      const payload = JSON.stringify({
        schoolId,
        studentId: selectedStudent!.id,
        invoiceStatus,
        issueDate: effectiveIssueDate,
        dueDate: effectiveDueDate,
        discountAmount: discount,
        currencyCode,
        notes,
        items: cleanItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitAmount: item.unitAmount,
        })),
      });
      if (idempotencyPayloadRef.current !== payload) {
        idempotencyKeyRef.current = crypto.randomUUID();
        idempotencyPayloadRef.current = payload;
      }

      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: payload,
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create invoice.");
      }

      setMessage(`Invoice created successfully: ${body.invoiceNumber}`);
      setSelectedStudent(null);
      setInvoiceStatus("ISSUED");
      setIssueDate("");
      setDueDate("");
      setDiscountAmount("0");
      setNotes("");
      setItems([emptyItem()]);
      setPreviewVisible(false);
      idempotencyKeyRef.current = "";
      idempotencyPayloadRef.current = "";
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadFinanceSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Create Invoice
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a draft or issued invoice for a student. Preview it before saving.
          </p>

          {settingsLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Loading finance defaults...
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface"
        >
          {open ? "Close" : "New Invoice"}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-success/40 bg-success-subtle p-3 text-sm text-success">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {open ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <StudentSelectorClient
                schoolId={schoolId}
                selectedStudent={selectedStudent}
                onSelect={(student) => {
                  setSelectedStudent(student);
                  setPreviewVisible(false);
                }}
                label="Select Student"
              />
            </div>

            <select
              className="rounded-xl border border-input px-3 py-2 text-sm"
              value={invoiceStatus}
              onChange={(e) => {
                setInvoiceStatus(e.target.value as "DRAFT" | "ISSUED");
                setPreviewVisible(false);
              }}
            >
              <option value="ISSUED">Issued</option>
              <option value="DRAFT">Draft</option>
            </select>

            <select
              className="rounded-xl border border-input px-3 py-2 text-sm"
              value={currencyCode}
              onChange={(e) => {
                setCurrencyCode(e.target.value);
                setPreviewVisible(false);
              }}
            >
              <option value="USD">USD</option>
              <option value="HTG">HTG</option>
            </select>

            <input
              type="date"
              className="rounded-xl border border-input px-3 py-2 text-sm"
              value={issueDate}
              onChange={(e) => {
                setIssueDate(e.target.value);
                setPreviewVisible(false);
              }}
            />

            <input
              type="date"
              className="rounded-xl border border-input px-3 py-2 text-sm"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setPreviewVisible(false);
              }}
            />

            <input
              className="rounded-xl border border-input px-3 py-2 text-sm"
              placeholder="Discount amount"
              value={discountAmount}
              onChange={(e) => {
                setDiscountAmount(e.target.value);
                setPreviewVisible(false);
              }}
            />

            <textarea
              className="rounded-xl border border-input px-3 py-2 text-sm md:col-span-2"
              placeholder="Notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setPreviewVisible(false);
              }}
            />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="font-semibold text-foreground">Invoice Items</div>

              <button
                type="button"
                onClick={addItem}
                className="rounded-xl border border-input bg-surface px-3 py-2 text-sm hover:bg-surface"
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
                    className="grid gap-3 rounded-xl border border-border bg-surface p-3 md:grid-cols-[1fr_120px_140px_140px_auto]"
                  >
                    <input
                      className="rounded-xl border border-input px-3 py-2 text-sm"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, { description: e.target.value })
                      }
                    />

                    <input
                      className="rounded-xl border border-input px-3 py-2 text-sm"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, { quantity: e.target.value })
                      }
                    />

                    <input
                      className="rounded-xl border border-input px-3 py-2 text-sm"
                      placeholder="Unit amount"
                      value={item.unitAmount}
                      onChange={(e) =>
                        updateItem(index, { unitAmount: e.target.value })
                      }
                    />

                    <div className="rounded-xl bg-surface px-3 py-2 text-sm font-semibold">
                      {money(lineTotal, currencyCode)}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger-subtle"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Subtotal</div>
              <div className="mt-2 text-2xl font-bold">
                {money(subtotal, currencyCode)}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Discount</div>
              <div className="mt-2 text-2xl font-bold">
                {money(discount, currencyCode)}
              </div>
            </div>

            <div className="rounded-2xl border border-input bg-primary p-4 text-solid-foreground">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="mt-2 text-2xl font-bold">
                {money(total, currencyCode)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={previewInvoice}
              className="rounded-xl border border-input px-4 py-3 text-sm font-medium hover:bg-surface"
            >
              Preview Invoice
            </button>

            <button
              type="button"
              disabled={saving || !previewVisible}
              onClick={createInvoice}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Invoice"}
            </button>
          </div>

          {!previewVisible ? (
            <div className="rounded-xl bg-warning-subtle p-3 text-sm text-warning">
              Preview the invoice before creating it.
            </div>
          ) : null}

          {previewVisible ? (
            <div className="rounded-3xl border border-input bg-surface p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                    Invoice Preview
                  </div>

                  <h4 className="mt-2 text-2xl font-bold text-foreground">
                    Pending Invoice
                  </h4>

                  <div className="mt-1 text-sm text-muted-foreground">
                    This invoice has not been saved yet.
                  </div>
                </div>

                <div className="text-right">
                  <SchoolBadge tone={invoiceStatus === "DRAFT" ? "amber" : "blue"}>
                    {invoiceStatus}
                  </SchoolBadge>

                  <div className="mt-3 text-sm text-muted-foreground">
                    Issue date: {effectiveIssueDate}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Due date: {effectiveDueDate}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 border-b border-border py-5 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Student
                  </div>
                  <div className="mt-1 break-all font-semibold text-foreground">
                    {selectedStudent
                      ? `${selectedStudent.firstName ?? ""} ${selectedStudent.lastName ?? ""}`.trim() ||
                        selectedStudent.studentCode ||
                        selectedStudent.id
                      : "-"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {selectedStudent?.studentCode ?? ""}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Currency
                  </div>
                  <div className="mt-1 font-semibold text-foreground">
                    {currencyCode}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Items
                  </div>
                  <div className="mt-1 font-semibold text-foreground">
                    {cleanItems.length}
                  </div>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-muted text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit Amount</th>
                      <th className="px-4 py-3">Line Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {cleanItems.map((item, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {item.description}
                        </td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3">
                          {money(item.unitAmount, currencyCode)}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {money(item.lineTotal, currencyCode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-sm rounded-2xl border border-border p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">
                        {money(subtotal, currencyCode)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="font-medium">
                        {money(discount, currencyCode)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4 border-t border-border pt-2 text-lg">
                      <span className="font-bold text-foreground">Total</span>
                      <span className="font-bold text-foreground">
                        {money(total, currencyCode)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {notes ? (
                <div className="mt-5 rounded-2xl border border-border p-4">
                  <div className="text-sm font-semibold text-foreground">
                    Notes
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{notes}</p>
                </div>
              ) : null}

              <div className="mt-5 rounded-xl bg-success-subtle p-3 text-sm text-success">
                Preview ready. You can now create this invoice.
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
