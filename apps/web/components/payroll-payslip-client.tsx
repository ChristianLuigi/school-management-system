"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type PayrollPayslipDetails = {
  school: {
    name: string;
    code: string | null;
  };
  run: {
    id: string;
    payrollNumber: string | null;
    periodLabel: string;
    periodStart: string | null;
    periodEnd: string | null;
    payrollStatus: string;
    currencyCode: string;
  };
  staff: {
    id: string;
    staffCode: string | null;
    fullName: string;
    positionTitle: string | null;
    department: string | null;
    employmentType: string;
    payFrequency: string;
  };
  item: {
    id: string;
    grossSalary: number;
    allowances: number;
    deductions: number;
    netSalary: number;
    paymentStatus: string;
    paidAt: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
    notes: string | null;
  };
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function paymentTone(status: string): BadgeTone {
  if (status === "PAID") return "green";
  if (status === "PENDING") return "amber";
  if (status === "CANCELLED") return "red";
  return "blue";
}

function employmentLabel(value: string) {
  const labels: Record<string, string> = {
    FULL_TIME: "Temps plein",
    PART_TIME: "Temps partiel",
    CONTRACTOR: "Contractuel",
    TEMPORARY: "Temporaire",
  };

  return labels[value] ?? value;
}

function frequencyLabel(value: string) {
  const labels: Record<string, string> = {
    MONTHLY: "Mensuel",
    BIWEEKLY: "Aux deux semaines",
    WEEKLY: "Hebdomadaire",
    DAILY: "Journalier",
  };

  return labels[value] ?? value;
}

export function PayrollPayslipClient({
  schoolId,
  itemId,
}: {
  schoolId: string;
  itemId: string;
}) {
  const [details, setDetails] = useState<PayrollPayslipDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadPayslip() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/payroll/items/${itemId}/payslip?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load payslip.");
      }

      setDetails(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payslip.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayslip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, itemId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={details ? `/finance/payroll/runs/${details.run.id}` : "/finance/payroll"}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Back to Payroll Run
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Print / Save as PDF
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 print:hidden">
          Loading payslip...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      ) : null}

      {details ? (
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="text-sm uppercase text-slate-500">
                Bulletin de paie
              </div>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                {details.school.name}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {details.school.code ? `${details.school.code} - ` : ""}
                Payroll Payslip
              </p>
            </div>

            <SchoolBadge tone={paymentTone(details.item.paymentStatus)}>
              {details.item.paymentStatus}
            </SchoolBadge>
          </div>

          <div className="grid gap-6 border-b border-slate-200 py-6 md:grid-cols-2">
            <div>
              <h2 className="font-semibold text-slate-900">Staff</h2>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-900">Name:</span>{" "}
                  {details.staff.fullName}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Code:</span>{" "}
                  {details.staff.staffCode ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Position:</span>{" "}
                  {details.staff.positionTitle ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Department:</span>{" "}
                  {details.staff.department ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Employment:</span>{" "}
                  {employmentLabel(details.staff.employmentType)}
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">Payroll Period</h2>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-900">Payroll:</span>{" "}
                  {details.run.payrollNumber ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Period:</span>{" "}
                  {details.run.periodLabel}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Start:</span>{" "}
                  {details.run.periodStart ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">End:</span>{" "}
                  {details.run.periodEnd ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Frequency:</span>{" "}
                  {frequencyLabel(details.staff.payFrequency)}
                </div>
              </div>
            </div>
          </div>

          <div className="py-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Gross salary</span>
                  <span className="font-semibold">
                    {money(details.item.grossSalary, details.run.currencyCode)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Allowances</span>
                  <span className="font-semibold">
                    {money(details.item.allowances, details.run.currencyCode)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Deductions</span>
                  <span className="font-semibold">
                    {money(details.item.deductions, details.run.currencyCode)}
                  </span>
                </div>

                <div className="flex justify-between border-t border-slate-200 pt-4 text-lg font-bold">
                  <span>Net salary</span>
                  <span>
                    {money(details.item.netSalary, details.run.currencyCode)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-t border-slate-200 py-6 md:grid-cols-2">
            <div>
              <h2 className="font-semibold text-slate-900">Payment</h2>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-900">Status:</span>{" "}
                  {details.item.paymentStatus}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Paid at:</span>{" "}
                  {details.item.paidAt
                    ? new Date(details.item.paidAt).toLocaleString()
                    : "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Method:</span>{" "}
                  {details.item.paymentMethod ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Reference:</span>{" "}
                  {details.item.paymentReference ?? "-"}
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">Notes</h2>

              <p className="mt-3 text-sm text-slate-600">
                {details.item.notes ?? "No notes."}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
                Staff signature
              </div>
            </div>

            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
                Administration / Finance
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-slate-500">
            This payslip summarizes salary information for the selected payroll period.
          </div>
        </div>
      ) : null}
    </div>
  );
}
