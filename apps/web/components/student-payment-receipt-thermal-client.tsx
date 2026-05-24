"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type PaymentReceiptDetails = {
  payment: {
    id: string;
    paymentNumber: string | null;
    paymentStatus: string;
    paymentMethod: string | null;
    paymentReference: string | null;
    currencyCode: string;
    amount: number;
    paidAt: string | null;
    notes: string | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string | null;
    invoiceTitle: string | null;
    invoiceStatus: string | null;
    currencyCode: string | null;
    totalAmount: number | null;
  } | null;
  student: {
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  school: {
    name: string;
    code: string | null;
  };
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

export function StudentPaymentReceiptThermalClient({
  schoolId,
  paymentId,
}: {
  schoolId: string;
  paymentId: string;
}) {
  const [receipt, setReceipt] = useState<PaymentReceiptDetails | null>(null);
  const [error, setError] = useState("");

  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("autoprint") === "1";

  async function loadReceipt() {
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/payments/${paymentId}?${params.toString()}`,
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
    }
  }

  useEffect(() => {
    loadReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, paymentId]);

  useEffect(() => {
    if (!receipt || !autoPrint) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [receipt, autoPrint]);

  return (
    <div className="thermal-print-page">
      <div className="thermal-no-print flex gap-2 p-4">
        <Link
          href={`/finance/payments/${paymentId}/receipt`}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Back
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
        >
          Print 80mm
        </button>
      </div>

      {error ? (
        <div className="thermal-no-print p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {receipt ? (
        <div className="thermal-receipt">
          <div className="thermal-center">
            <div className="thermal-bold">{receipt.school.name}</div>
            {receipt.school.code ? <div>{receipt.school.code}</div> : null}
            <div className="thermal-small">Payment receipt</div>
          </div>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Receipt</span>
            <span>{receipt.payment.paymentNumber ?? "-"}</span>
          </div>

          <div className="thermal-row">
            <span>Date</span>
            <span>
              {receipt.payment.paidAt
                ? new Date(receipt.payment.paidAt).toLocaleString()
                : "-"}
            </span>
          </div>

          <div className="thermal-row">
            <span>Status</span>
            <span>{receipt.payment.paymentStatus}</span>
          </div>

          <div className="thermal-divider" />

          <div>
            <div className="thermal-bold">Student</div>
            <div>
              {receipt.student.firstName} {receipt.student.lastName}
            </div>
            <div>Code: {receipt.student.studentCode ?? "-"}</div>
          </div>

          <div className="thermal-divider" />

          <div>
            <div className="thermal-bold">Invoice</div>
            <div>{receipt.invoice?.invoiceNumber ?? "-"}</div>
            <div>{receipt.invoice?.invoiceTitle ?? "-"}</div>
          </div>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Method</span>
            <span>{receipt.payment.paymentMethod ?? "-"}</span>
          </div>

          <div className="thermal-row">
            <span>Reference</span>
            <span>{receipt.payment.paymentReference ?? "-"}</span>
          </div>

          {receipt.invoice?.totalAmount != null ? (
            <div className="thermal-row">
              <span>Invoice total</span>
              <span>
                {money(
                  receipt.invoice.totalAmount,
                  receipt.invoice.currencyCode ?? receipt.payment.currencyCode,
                )}
              </span>
            </div>
          ) : null}

          <div className="thermal-row thermal-total">
            <span>Paid</span>
            <span>
              {money(receipt.payment.amount, receipt.payment.currencyCode)}
            </span>
          </div>

          {receipt.payment.notes ? (
            <>
              <div className="thermal-divider" />
              <div className="thermal-bold">Notes</div>
              <div>{receipt.payment.notes}</div>
            </>
          ) : null}

          <div className="thermal-divider" />

          <div className="thermal-center thermal-small">
            Parent signature: __________
          </div>

          <div className="thermal-center thermal-small">
            Cashier: ________________
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