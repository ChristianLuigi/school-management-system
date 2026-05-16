"use client";

import { useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type RegistrationFee = {
  required: boolean;
  amount: number;
  currencyCode: string;
  status: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  receiptNumber: string | null;
  notes: string | null;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function feeStatusTone(status: string) {
  if (status === "PAID" || status === "WAIVED") return "green";
  if (status === "PENDING") return "amber";
  if (status === "REFUNDED") return "neutral";
  return "blue";
}

function feeStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NOT_REQUIRED: "Non requis",
    PENDING: "En attente",
    PAID: "Paye",
    WAIVED: "Exonere",
    REFUNDED: "Rembourse",
  };

  return labels[status] ?? status;
}

export function AdmissionRegistrationFeePanelClient({
  schoolId,
  admissionApplicationId,
  fee,
  convertedStudentId,
  onUpdated,
}: {
  schoolId: string;
  admissionApplicationId: string;
  fee: RegistrationFee;
  convertedStudentId?: string | null;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [required, setRequired] = useState(fee.required);
  const [amount, setAmount] = useState(String(fee.amount ?? 0));
  const [currencyCode, setCurrencyCode] = useState(fee.currencyCode ?? "USD");
  const [status, setStatus] = useState(fee.status ?? "NOT_REQUIRED");
  const [paymentMethod, setPaymentMethod] = useState(fee.paymentMethod ?? "");
  const [paymentReference, setPaymentReference] = useState(
    fee.paymentReference ?? "",
  );
  const [notes, setNotes] = useState(fee.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRequired(fee.required);
    setAmount(String(fee.amount ?? 0));
    setCurrencyCode(fee.currencyCode ?? "USD");
    setStatus(fee.status ?? "NOT_REQUIRED");
    setPaymentMethod(fee.paymentMethod ?? "");
    setPaymentReference(fee.paymentReference ?? "");
    setNotes(fee.notes ?? "");
  }, [fee]);

  async function saveFee() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const numericAmount = Number(amount);

      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw new Error("Registration fee amount must be valid.");
      }

      const res = await fetch(
        `/api/admissions/${admissionApplicationId}/registration-fee`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schoolId,
            registrationFeeRequired: required,
            registrationFeeAmount: numericAmount,
            registrationFeeCurrencyCode: currencyCode,
            registrationFeeStatus: required ? status : "NOT_REQUIRED",
            registrationPaymentMethod: paymentMethod,
            registrationPaymentReference: paymentReference,
            registrationPaymentNotes: notes,
          }),
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to update registration fee.");
      }

      setMessage("Registration fee updated successfully.");
      setOpen(false);
      onUpdated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update registration fee.",
      );
    } finally {
      setSaving(false);
    }
  }

  const locked = Boolean(convertedStudentId);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Frais d'inscription
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Suivre le paiement requis avant confirmation ou conversion en eleve.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SchoolBadge tone={feeStatusTone(fee.status) as any}>
              {feeStatusLabel(fee.status)}
            </SchoolBadge>

            {fee.required ? (
              <span className="text-sm font-medium text-slate-700">
                {money(fee.amount, fee.currencyCode)}
              </span>
            ) : (
              <span className="text-sm text-slate-500">Non requis</span>
            )}
          </div>
        </div>

        {!locked ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            {open ? "Close" : "Update Fee"}
          </button>
        ) : null}
      </div>

      {fee.receiptNumber ? (
        <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
          Receipt: <span className="font-semibold">{fee.receiptNumber}</span>
          {fee.paidAt ? ` - Paid at ${new Date(fee.paidAt).toLocaleString()}` : ""}
        </div>
      ) : null}

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

      {locked ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          This application is locked because it has already been converted.
        </div>
      ) : null}

      {open && !locked ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => {
                setRequired(event.target.checked);
                setStatus(event.target.checked ? "PENDING" : "NOT_REQUIRED");
              }}
            />
            Registration fee required
          </label>

          {required ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />

                <select
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={currencyCode}
                  onChange={(event) => setCurrencyCode(event.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="HTG">HTG</option>
                </select>

                <select
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="PENDING">En attente</option>
                  <option value="PAID">Paye</option>
                  <option value="WAIVED">Exonere</option>
                  <option value="REFUNDED">Rembourse</option>
                </select>

                <select
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
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
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                  placeholder="Payment reference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                />
              </div>

              <textarea
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Payment notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={saveFee}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Registration Fee"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
