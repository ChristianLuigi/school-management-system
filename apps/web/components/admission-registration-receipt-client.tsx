"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge, type SchoolBadgeTone } from "@/components/school-ui";

type AdmissionReceiptDetails = {
  id: string;
  applicationNumber: string;
  admissionStatus: string;
  candidate: {
    firstName: string;
    lastName: string;
    gender: string | null;
    dateOfBirth: string | null;
  };
  parent: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
  };
  registrationFee: {
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
  createdAt: string;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
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

function feeStatusTone(status: string): SchoolBadgeTone {
  if (status === "PAID" || status === "WAIVED") return "green";
  if (status === "PENDING") return "amber";
  if (status === "REFUNDED") return "neutral";
  return "blue";
}

export function AdmissionRegistrationReceiptClient({
  schoolId,
  admissionApplicationId,
}: {
  schoolId: string;
  admissionApplicationId: string;
}) {
  const [application, setApplication] =
    useState<AdmissionReceiptDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReceipt() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/admissions/${admissionApplicationId}?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load admission receipt.");
      }

      setApplication(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load admission receipt.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, admissionApplicationId]);

  const canPrintReceipt = application
    ? ["PAID", "WAIVED"].includes(application.registrationFee.status)
    : false;

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admissions/${admissionApplicationId}`}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Back to Admission
        </Link>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admissions/${admissionApplicationId}/registration-receipt/thermal`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Thermal 80mm
          </Link>

          <Link
            href={`/admissions/${admissionApplicationId}/registration-receipt/thermal?autoprint=1`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Quick 80mm Print
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={!canPrintReceipt}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="print:hidden rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading receipt...
        </div>
      ) : null}

      {error ? (
        <div className="print:hidden rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {application && !canPrintReceipt ? (
        <div className="print:hidden rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This registration fee has not been paid or waived yet. A receipt
          should only be printed after payment or waiver.
        </div>
      ) : null}

      {application && canPrintReceipt ? (
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                Recu frais d’inscription
              </div>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Admission Receipt
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Application: {application.applicationNumber}
              </p>
            </div>

            <SchoolBadge
              tone={feeStatusTone(application.registrationFee.status)}
            >
              {feeStatusLabel(application.registrationFee.status)}
            </SchoolBadge>
          </div>

          <div className="grid gap-6 border-b border-slate-200 py-6 md:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Candidate
              </div>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-900">Name:</span>{" "}
                  {application.candidate.firstName}{" "}
                  {application.candidate.lastName}
                </div>

                <div>
                  <span className="font-medium text-slate-900">
                    Date of birth:
                  </span>{" "}
                  {application.candidate.dateOfBirth ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">
                    Application date:
                  </span>{" "}
                  {new Date(application.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900">
                Parent / Guardian
              </div>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-900">Name:</span>{" "}
                  {application.parent.fullName ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Phone:</span>{" "}
                  {application.parent.phone ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Email:</span>{" "}
                  {application.parent.email ?? "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="py-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-slate-500">Receipt number</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {application.registrationFee.receiptNumber ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-slate-500">Payment date</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {application.registrationFee.paidAt
                      ? new Date(
                          application.registrationFee.paidAt,
                        ).toLocaleDateString()
                      : "-"}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-slate-500">Payment method</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {application.registrationFee.paymentMethod ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-slate-500">Reference</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {application.registrationFee.paymentReference ?? "-"}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between border-t border-slate-200 pt-4">
                <span className="text-lg font-semibold text-slate-900">
                  Amount
                </span>

                <span className="text-2xl font-bold text-slate-900">
                  {money(
                    application.registrationFee.amount,
                    application.registrationFee.currencyCode,
                  )}
                </span>
              </div>
            </div>
          </div>

          {application.registrationFee.notes ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">Notes</div>
              <p className="mt-2 text-sm text-slate-600">
                {application.registrationFee.notes}
              </p>
            </div>
          ) : null}

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
                Parent / Guardian signature
              </div>
            </div>

            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
                School cashier / administration
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-slate-500">
            Please keep this receipt for your records.
          </div>
        </div>
      ) : null}
    </div>
  );
}
