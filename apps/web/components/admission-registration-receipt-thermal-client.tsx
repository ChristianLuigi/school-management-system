"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type AdmissionReceiptDetails = {
  id: string;
  applicationNumber: string;
  candidate: {
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
  };
  parent: {
    fullName: string | null;
    phone: string | null;
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

export function AdmissionRegistrationReceiptThermalClient({
  schoolId,
  admissionApplicationId,
}: {
  schoolId: string;
  admissionApplicationId: string;
}) {
  const [application, setApplication] =
    useState<AdmissionReceiptDetails | null>(null);
  const [error, setError] = useState("");

  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("autoprint") === "1";

  async function loadReceipt() {
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
        err instanceof Error ? err.message : "Failed to load admission receipt.",
      );
    }
  }

  useEffect(() => {
    loadReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, admissionApplicationId]);

  const canPrintReceipt = application
    ? ["PAID", "WAIVED"].includes(application.registrationFee.status)
    : false;

  useEffect(() => {
    if (!application || !autoPrint || !canPrintReceipt) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [application, autoPrint, canPrintReceipt]);

  return (
    <div className="thermal-print-page bg-white">
      <div className="thermal-no-print flex gap-2 p-4">
        <Link
          href={`/admissions/${admissionApplicationId}/registration-receipt`}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Back
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          disabled={!canPrintReceipt}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Print Thermal
        </button>
      </div>

      {error ? (
        <div className="thermal-no-print p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {application && !canPrintReceipt ? (
        <div className="thermal-no-print p-4 text-sm text-amber-800">
          This registration fee has not been paid or waived yet. A receipt should
          only be printed after payment or waiver.
        </div>
      ) : null}

      {application && canPrintReceipt ? (
        <div className="thermal-receipt">
          <div className="thermal-center">
            <div className="thermal-bold">ADMISSION RECEIPT</div>
            <div>Frais d'inscription</div>
          </div>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Receipt</span>
            <span>{application.registrationFee.receiptNumber ?? "-"}</span>
          </div>

          <div className="thermal-row">
            <span>Application</span>
            <span>{application.applicationNumber}</span>
          </div>

          <div className="thermal-row">
            <span>Status</span>
            <span>{feeStatusLabel(application.registrationFee.status)}</span>
          </div>

          <div className="thermal-row">
            <span>Date</span>
            <span>
              {application.registrationFee.paidAt
                ? new Date(
                    application.registrationFee.paidAt,
                  ).toLocaleDateString()
                : "-"}
            </span>
          </div>

          <div className="thermal-divider" />

          <div>
            <div className="thermal-bold">Candidate</div>
            <div>
              {application.candidate.firstName}{" "}
              {application.candidate.lastName}
            </div>
            <div>DOB: {application.candidate.dateOfBirth ?? "-"}</div>
          </div>

          <div className="thermal-divider" />

          <div>
            <div className="thermal-bold">Parent</div>
            <div>{application.parent.fullName ?? "-"}</div>
            <div>{application.parent.phone ?? "-"}</div>
          </div>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Method</span>
            <span>{application.registrationFee.paymentMethod ?? "-"}</span>
          </div>

          <div className="thermal-row">
            <span>Reference</span>
            <span>{application.registrationFee.paymentReference ?? "-"}</span>
          </div>

          <div className="thermal-row thermal-total">
            <span>Amount</span>
            <span>
              {money(
                application.registrationFee.amount,
                application.registrationFee.currencyCode,
              )}
            </span>
          </div>

          {application.registrationFee.notes ? (
            <>
              <div className="thermal-divider" />
              <div className="thermal-bold">Notes</div>
              <div>{application.registrationFee.notes}</div>
            </>
          ) : null}

          <div className="thermal-divider" />

          <div className="thermal-center thermal-small">
            Parent signature: __________
          </div>

          <div className="thermal-center thermal-small">
            Cashier: _________________
          </div>

          <div className="thermal-divider" />

          <div className="thermal-center thermal-small">
            Please keep this receipt.
          </div>
        </div>
      ) : null}
    </div>
  );
}
