"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type PayrollRunDetails = {
  run: {
    id: string;
    payrollNumber: string | null;
    periodLabel: string;
    periodStart: string | null;
    periodEnd: string | null;
    payrollStatus: string;
    currencyCode: string;
    totalGross: number;
    totalAllowances: number;
    totalDeductions: number;
    totalNet: number;
    notes: string | null;
    createdAt: string;
  };
  items: Array<{
    id: string;
    payrollStaffProfileId: string;
    grossSalary: number;
    allowances: number;
    deductions: number;
    netSalary: number;
    paymentStatus: string;
    paidAt: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
    notes: string | null;
    staff: {
      fullName: string;
      staffCode: string | null;
      positionTitle: string | null;
      department: string | null;
      employmentType: string;
      payFrequency: string;
      currencyCode: string;
    };
  }>;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function statusTone(status: string): BadgeTone {
  if (status === "PAID") return "green";
  if (status === "PENDING" || status === "DRAFT") return "amber";
  if (status === "CANCELLED") return "red";
  return "blue";
}

export function PayrollRunDetailClient({
  schoolId,
  runId,
}: {
  schoolId: string;
  runId: string;
}) {
  const [details, setDetails] = useState<PayrollRunDetails | null>(null);
  const [openItemId, setOpenItemId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadDetails() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/payroll/runs/${runId}?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load payroll run.");
      }

      setDetails(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load payroll run.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function markPaid(itemId: string) {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/finance/payroll/items/${itemId}/payment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          paidAt: paidAt || undefined,
          paymentMethod,
          paymentReference: paymentReference || undefined,
          notes: notes || undefined,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to mark salary as paid.");
      }

      setMessage("Salary marked as paid.");
      setOpenItemId("");
      setPaymentMethod("CASH");
      setPaymentReference("");
      setPaidAt("");
      setNotes("");

      await loadDetails();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark salary as paid.",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, runId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/finance/payroll"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Back to Payroll
        </Link>

        <button
          type="button"
          onClick={loadDetails}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {!details && !error ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading payroll run...
        </div>
      ) : null}

      {details ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {details.run.payrollNumber ?? "Payroll Run"}
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  {details.run.periodLabel}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {details.run.periodStart ?? "-"} to{" "}
                  {details.run.periodEnd ?? "-"}
                </p>
              </div>

              <SchoolBadge tone={statusTone(details.run.payrollStatus)}>
                {details.run.payrollStatus}
              </SchoolBadge>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Gross</div>
                <div className="mt-1 text-xl font-bold">
                  {money(details.run.totalGross, details.run.currencyCode)}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Allowances</div>
                <div className="mt-1 text-xl font-bold">
                  {money(details.run.totalAllowances, details.run.currencyCode)}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Deductions</div>
                <div className="mt-1 text-xl font-bold">
                  {money(details.run.totalDeductions, details.run.currencyCode)}
                </div>
              </div>

              <div className="rounded-xl bg-green-50 p-4">
                <div className="text-sm text-green-800">Net payroll</div>
                <div className="mt-1 text-xl font-bold text-green-950">
                  {money(details.run.totalNet, details.run.currencyCode)}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">Payroll Items</h3>

            <div className="mt-4 space-y-3">
              {details.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {item.staff.fullName}
                      </div>

                      <div className="mt-1 text-sm text-slate-600">
                        {item.staff.positionTitle ?? "No position"}
                        {item.staff.department
                          ? ` - ${item.staff.department}`
                          : ""}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {item.staff.staffCode
                          ? `Code: ${item.staff.staffCode}`
                          : ""}
                      </div>
                    </div>

                    <SchoolBadge tone={statusTone(item.paymentStatus)}>
                      {item.paymentStatus}
                    </SchoolBadge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div>
                      <div className="text-xs text-slate-500">Gross</div>
                      <div className="font-semibold">
                        {money(item.grossSalary, details.run.currencyCode)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">Allowances</div>
                      <div className="font-semibold">
                        {money(item.allowances, details.run.currencyCode)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">Deductions</div>
                      <div className="font-semibold">
                        {money(item.deductions, details.run.currencyCode)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">Net</div>
                      <div className="font-semibold">
                        {money(item.netSalary, details.run.currencyCode)}
                      </div>
                    </div>
                  </div>

                  {item.paidAt ? (
                    <div className="mt-3 text-xs text-slate-500">
                      Paid at: {new Date(item.paidAt).toLocaleString()}
                      {item.paymentMethod ? ` - ${item.paymentMethod}` : ""}
                      {item.paymentReference
                        ? ` - Ref: ${item.paymentReference}`
                        : ""}
                    </div>
                  ) : null}

                  {item.paymentStatus !== "PAID" ? (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenItemId(
                            openItemId === item.id ? "" : item.id,
                          );
                          setPaymentMethod("CASH");
                          setPaymentReference("");
                          setPaidAt("");
                          setNotes("");
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"
                      >
                        {openItemId === item.id ? "Close" : "Mark Paid"}
                      </button>

                      {openItemId === item.id ? (
                        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <select
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              value={paymentMethod}
                              onChange={(event) =>
                                setPaymentMethod(event.target.value)
                              }
                            >
                              <option value="CASH">Cash</option>
                              <option value="BANK_TRANSFER">Bank transfer</option>
                              <option value="CHECK">Check</option>
                              <option value="MOBILE_MONEY">Mobile money</option>
                              <option value="OTHER">Other</option>
                            </select>

                            <input
                              type="datetime-local"
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              value={paidAt}
                              onChange={(event) => setPaidAt(event.target.value)}
                            />

                            <input
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                              placeholder="Payment reference"
                              value={paymentReference}
                              onChange={(event) =>
                                setPaymentReference(event.target.value)
                              }
                            />
                          </div>

                          <textarea
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Notes"
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                          />

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => markPaid(item.id)}
                            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                          >
                            {saving ? "Saving..." : "Confirm Payment"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}

              {details.items.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No payroll items found.
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
