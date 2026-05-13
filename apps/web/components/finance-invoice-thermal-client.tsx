"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type InvoiceDetails = {
  id: string;
  school: {
    name: string;
    code: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    financeSettings?: {
      invoiceFooterI18n: Record<string, string>;
    };
  };
  student: {
    code: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  invoiceNumber: string | null;
  invoiceStatus: string;
  issueDate: string;
  dueDate: string | null;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  currencyCode: string;
  notes: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitAmount: number;
    lineTotal: number;
  }>;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function FinanceInvoiceThermalClient({
  schoolId,
  invoiceId,
}: {
  schoolId: string;
  invoiceId: string;
}) {
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
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

      setInvoice(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoice.");
    }
  }

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, invoiceId]);

  useEffect(() => {
    if (!invoice || !autoPrint) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [invoice, autoPrint]);

  return (
    <div className="thermal-print-page bg-white">
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
          Print Thermal
        </button>
      </div>

      {error ? (
        <div className="thermal-no-print p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {invoice ? (
        <div className="thermal-receipt">
          <div className="thermal-center">
            <div className="thermal-bold">{invoice.school.name}</div>
            <div>{invoice.school.code}</div>
            {invoice.school.addressLine1 ? <div>{invoice.school.addressLine1}</div> : null}
            {invoice.school.addressLine2 ? <div>{invoice.school.addressLine2}</div> : null}
            {invoice.school.city ? <div>{invoice.school.city}</div> : null}
            {invoice.school.phone ? <div>Tel: {invoice.school.phone}</div> : null}
            {invoice.school.email ? <div>{invoice.school.email}</div> : null}
          </div>

          <div className="thermal-divider" />

          <div className="thermal-center thermal-bold">INVOICE</div>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Invoice</span>
            <span>{invoice.invoiceNumber ?? invoice.id.slice(0, 8)}</span>
          </div>

          <div className="thermal-row">
            <span>Status</span>
            <span>{invoice.invoiceStatus}</span>
          </div>

          <div className="thermal-row">
            <span>Issue</span>
            <span>{invoice.issueDate}</span>
          </div>

          <div className="thermal-row">
            <span>Due</span>
            <span>{invoice.dueDate ?? "-"}</span>
          </div>

          <div className="thermal-divider" />

          <div>
            <div className="thermal-bold">Student</div>
            <div>
              {invoice.student
                ? `${invoice.student.firstName ?? ""} ${invoice.student.lastName ?? ""}`.trim()
                : "No student"}
            </div>
            <div>{invoice.student?.code ?? "Code pending"}</div>
          </div>

          <div className="thermal-divider" />

          <div className="thermal-bold">Items</div>

          {invoice.items.map((item) => (
            <div key={item.id} className="mt-2">
              <div>{item.description}</div>
              <div className="thermal-row">
                <span>
                  {item.quantity} x {money(item.unitAmount, invoice.currencyCode)}
                </span>
                <span>{money(item.lineTotal, invoice.currencyCode)}</span>
              </div>
            </div>
          ))}

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Subtotal</span>
            <span>{money(invoice.subtotalAmount, invoice.currencyCode)}</span>
          </div>

          <div className="thermal-row">
            <span>Discount</span>
            <span>{money(invoice.discountAmount, invoice.currencyCode)}</span>
          </div>

          <div className="thermal-row thermal-total">
            <span>Total</span>
            <span>{money(invoice.totalAmount, invoice.currencyCode)}</span>
          </div>

          <div className="thermal-row">
            <span>Paid</span>
            <span>{money(invoice.amountPaid, invoice.currencyCode)}</span>
          </div>

          <div className="thermal-row thermal-total">
            <span>Balance</span>
            <span>{money(invoice.balanceDue, invoice.currencyCode)}</span>
          </div>

          {invoice.notes ? (
            <>
              <div className="thermal-divider" />
              <div className="thermal-bold">Notes</div>
              <div>{invoice.notes}</div>
            </>
          ) : null}

          <div className="thermal-divider" />

          <div className="thermal-center thermal-small">
            {invoice.school.financeSettings?.invoiceFooterI18n?.en ??
              invoice.school.financeSettings?.invoiceFooterI18n?.fr ??
              "Please keep this invoice for your records."}
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
