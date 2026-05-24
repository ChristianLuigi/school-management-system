"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type InvoiceDetails = {
  id: string;
  school: {
    name: string;
    code: string | null;
  };
  student: {
    id: string;
    code: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  invoiceNumber: string | null;
  invoiceTitle?: string | null;
  invoiceStatus: string;
  issueDate: string | null;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  currencyCode: string;
  notes: string | null;
  createdAt: string;
  payments: Array<{
    id: string;
    paymentNumber?: string | null;
    paymentStatus: string;
    paymentDate: string;
    amount: number;
    method: string | null;
    reference: string | null;
    notes: string | null;
    createdAt: string;
  }>;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function invoiceLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    ISSUED: "Issued",
    PARTIALLY_PAID: "Partially paid",
    PAID: "Paid",
    OVERDUE: "Overdue",
    VOID: "Cancelled",
    CANCELLED: "Cancelled",
  };

  return labels[status] ?? status;
}

export function StudentInvoiceThermalClient({
  schoolId,
  invoiceId,
}: {
  schoolId: string;
  invoiceId: string;
}) {
  const [details, setDetails] = useState<InvoiceDetails | null>(null);
  const [error, setError] = useState("");

  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("autoprint") === "1";

  async function loadInvoice() {
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/finance/invoices/${invoiceId}?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load invoice.");
      }

      setDetails(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoice.");
    }
  }

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, invoiceId]);

  useEffect(() => {
    if (!details || !autoPrint) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [details, autoPrint]);

  return (
    <div className="thermal-print-page">
      <div className="thermal-no-print flex gap-2 p-4">
        <Link
          href={`/finance/invoices/${invoiceId}`}
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

      {details ? (
        <div className="thermal-receipt">
          <div className="thermal-center">
            <div className="thermal-bold">{details.school.name}</div>
            {details.school.code ? <div>{details.school.code}</div> : null}
            <div className="thermal-small">School invoice</div>
          </div>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Invoice</span>
            <span>{details.invoiceNumber ?? "-"}</span>
          </div>

          <div className="thermal-row">
            <span>Status</span>
            <span>{invoiceLabel(details.invoiceStatus)}</span>
          </div>

          <div className="thermal-row">
            <span>Issued</span>
            <span>{details.issueDate ?? "-"}</span>
          </div>

          <div className="thermal-row">
            <span>Due</span>
            <span>{details.dueDate ?? "-"}</span>
          </div>

          <div className="thermal-divider" />

          <div>
            <div className="thermal-bold">Student</div>
            <div>
              {details.student
                ? `${details.student.firstName ?? ""} ${details.student.lastName ?? ""}`.trim()
                : "No student"}
            </div>
            <div>Code: {details.student?.code ?? "-"}</div>
          </div>

          <div className="thermal-divider" />

          <div>
            <div className="thermal-bold">Description</div>
            <div>{details.invoiceTitle ?? "School invoice"}</div>
          </div>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Total</span>
            <span>{money(details.totalAmount, details.currencyCode)}</span>
          </div>

          <div className="thermal-row">
            <span>Paid</span>
            <span>{money(details.amountPaid, details.currencyCode)}</span>
          </div>

          <div className="thermal-row thermal-total">
            <span>Balance</span>
            <span>{money(details.balanceDue, details.currencyCode)}</span>
          </div>

          {details.payments.length > 0 ? (
            <>
              <div className="thermal-divider" />
              <div className="thermal-bold">Payments</div>

              {details.payments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="thermal-row">
                  <span>{payment.paymentNumber ?? "Payment"}</span>
                  <span>{money(payment.amount, details.currencyCode)}</span>
                </div>
              ))}
            </>
          ) : null}

          {details.notes ? (
            <>
              <div className="thermal-divider" />
              <div className="thermal-bold">Notes</div>
              <div>{details.notes}</div>
            </>
          ) : null}

          <div className="thermal-divider" />

          <div className="thermal-center thermal-small">
            Parent signature: __________
          </div>

          <div className="thermal-center thermal-small">
            Administration: ___________
          </div>

          <div className="thermal-divider" />

          <div className="thermal-center thermal-small">
            Please keep this document.
          </div>
        </div>
      ) : null}
    </div>
  );
}