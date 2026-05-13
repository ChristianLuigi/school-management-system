"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type PaymentReceipt = {
  id: string;
  receiptNumber: string;
  paymentStatus: string;
  paymentDate: string;
  amount: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
  school: {
    name: string;
    code: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    financeSettings?: {
      receiptFooterI18n: Record<string, string>;
    };
  };
  invoice: {
    id: string;
    invoiceNumber: string | null;
    currencyCode: string;
    totalAmount: number | null;
    amountPaid: number | null;
    balanceDue: number | null;
  } | null;
  student: {
    code: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function FinancePaymentReceiptThermalClient({
  schoolId,
  paymentId,
}: {
  schoolId: string;
  paymentId: string;
}) {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("autoprint") === "1";

  async function loadReceipt() {
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/payments/${paymentId}/receipt?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load receipt.");
      }

      setReceipt(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load receipt.");
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
    <div className="thermal-print-page bg-white">
      <div className="thermal-no-print flex gap-2 p-4">
        <Link
          href="/finance"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Back
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
        >
          Print Thermal
        </button>
      </div>

      {error ? (
        <div className="thermal-no-print p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {receipt ? (
        <div className="thermal-receipt">
          <div className="thermal-center">
            <div className="thermal-bold">{receipt.school.name}</div>
            <div>{receipt.school.code}</div>
            {receipt.school.addressLine1 ? <div>{receipt.school.addressLine1}</div> : null}
            {receipt.school.addressLine2 ? <div>{receipt.school.addressLine2}</div> : null}
            {receipt.school.city ? <div>{receipt.school.city}</div> : null}
            {receipt.school.phone ? <div>Tel: {receipt.school.phone}</div> : null}
            {receipt.school.email ? <div>{receipt.school.email}</div> : null}
          </div>

          <div className="thermal-divider" />

          <div className="thermal-center thermal-bold">PAYMENT RECEIPT</div>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Receipt</span>
            <span>{receipt.receiptNumber}</span>
          </div>

          <div className="thermal-row">
            <span>Date</span>
            <span>{receipt.paymentDate}</span>
          </div>

          <div className="thermal-row">
            <span>Status</span>
            <span>{receipt.paymentStatus}</span>
          </div>

          <div className="thermal-row">
            <span>Method</span>
            <span>{receipt.method ?? "-"}</span>
          </div>

          {receipt.reference ? (
            <div className="thermal-row">
              <span>Reference</span>
              <span>{receipt.reference}</span>
            </div>
          ) : null}

          <div className="thermal-divider" />

          <div>
            <div className="thermal-bold">Student</div>
            <div>
              {receipt.student
                ? `${receipt.student.firstName ?? ""} ${receipt.student.lastName ?? ""}`.trim()
                : "Unknown"}
            </div>
            <div>{receipt.student?.code ?? "Code pending"}</div>
          </div>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Invoice</span>
            <span>{receipt.invoice?.invoiceNumber ?? "-"}</span>
          </div>

          <div className="thermal-row thermal-total">
            <span>Paid</span>
            <span>
              {money(receipt.amount, receipt.invoice?.currencyCode ?? "USD")}
            </span>
          </div>

          {receipt.invoice ? (
            <>
              <div className="thermal-row">
                <span>Invoice total</span>
                <span>
                  {receipt.invoice.totalAmount === null
                    ? "-"
                    : money(receipt.invoice.totalAmount, receipt.invoice.currencyCode)}
                </span>
              </div>

              <div className="thermal-row">
                <span>Total paid</span>
                <span>
                  {receipt.invoice.amountPaid === null
                    ? "-"
                    : money(receipt.invoice.amountPaid, receipt.invoice.currencyCode)}
                </span>
              </div>

              <div className="thermal-row">
                <span>Balance</span>
                <span>
                  {receipt.invoice.balanceDue === null
                    ? "-"
                    : money(receipt.invoice.balanceDue, receipt.invoice.currencyCode)}
                </span>
              </div>
            </>
          ) : null}

          {receipt.notes ? (
            <>
              <div className="thermal-divider" />
              <div className="thermal-bold">Notes</div>
              <div>{receipt.notes}</div>
            </>
          ) : null}

          <div className="thermal-divider" />

          <div className="thermal-center thermal-small">
            {receipt.school.financeSettings?.receiptFooterI18n?.en ??
              receipt.school.financeSettings?.receiptFooterI18n?.fr ??
              "Thank you for your payment."}
          </div>

          <div className="thermal-divider" />

          <div className="thermal-center thermal-small">
            Signature: __________________
          </div>
        </div>
      ) : null}
    </div>
  );
}
