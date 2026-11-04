"use client";

import { PaginatedCollection } from "@/components/paginated-collection";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FinanceInvoiceStatusActionsClient } from "@/components/finance-invoice-status-actions-client";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type InvoiceDetails = {
  capabilities: {
    canIssue: boolean;
    canVoid: boolean;
    canRequestCreditNote: boolean;
  };
  id: string;
  school: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    financeSettings?: {
      financeContactName: string | null;
      financeContactEmail: string | null;
      financeContactPhone: string | null;
      invoiceFooterI18n: Record<string, string>;
      defaultInvoicePrintFormat?: "A4" | "THERMAL_80MM";
    };
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
  issueDate: string;
  dueDate: string | null;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  currencyCode: string;
  notes: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitAmount: number;
    lineTotal: number;
  }>;
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

function statusTone(status: string): BadgeTone {
  if (status === "PAID" || status === "CONFIRMED") return "green";
  if (status === "OVERDUE") return "red";
  if (status === "PARTIALLY_PAID") return "amber";
  if (
    status === "VOID" ||
    status === "CANCELLED" ||
    status === "REVERSED" ||
    status === "REFUNDED"
  )
    return "neutral";
  if (
    status === "CORRECTION_PENDING" ||
    status === "CORRECTION_APPROVED"
  )
    return "amber";
  return "blue";
}

export function FinanceInvoiceDetailClient({
  schoolId,
  invoiceId,
}: {
  schoolId: string;
  invoiceId: string;
}) {
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadInvoice() {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, invoiceId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance"
            className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface"
          >
            Back to Finance
          </Link>
          {invoice?.capabilities.canRequestCreditNote &&
          invoice.balanceDue > 0 &&
          !["DRAFT", "VOID"].includes(invoice.invoiceStatus) ? (
            <Link
              href={`/finance/corrections?invoiceId=${encodeURIComponent(invoiceId)}`}
              className="rounded-xl border border-info/40 bg-info-subtle px-4 py-2 text-sm font-medium text-info hover:bg-info-subtle"
            >
              Request credit note
            </Link>
          ) : null}

          {invoice?.school.financeSettings?.defaultInvoicePrintFormat ===
          "THERMAL_80MM" ? (
            <Link
              href={`/finance/invoices/${invoiceId}/thermal?autoprint=1`}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary"
            >
              Print Preferred
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary"
            >
              Print Preferred
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface"
          >
            A4 / PDF
          </button>

          <Link
            href={`/finance/invoices/${invoiceId}/thermal`}
            className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface"
          >
            Thermal 80mm
          </Link>

          <Link
            href={`/finance/invoices/${invoiceId}/thermal?autoprint=1`}
            className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface"
          >
            Quick 80mm Print
          </Link>
        </div>

        <button
          type="button"
          onClick={loadInvoice}
          className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl bg-surface p-4 text-sm text-muted-foreground print:hidden">
          Loading invoice...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger print:hidden">
          {error}
        </div>
      ) : null}

      {invoice ? (
        <div className="space-y-6">
          <FinanceInvoiceStatusActionsClient
            schoolId={schoolId}
            invoiceId={invoice.id}
            invoiceStatus={invoice.invoiceStatus}
            amountPaid={invoice.amountPaid}
            canIssue={invoice.capabilities.canIssue}
            canVoid={invoice.capabilities.canVoid}
            onChanged={loadInvoice}
          />

          <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-surface p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <div className="border-b border-border pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                  Invoice
                </div>

                <h1 className="mt-2 text-3xl font-bold text-foreground">
                  {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                </h1>

                <div className="mt-1 text-sm text-muted-foreground">
                  {invoice.school.name} - {invoice.school.code}
                </div>

                <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                  {invoice.school.addressLine1 ? <div>{invoice.school.addressLine1}</div> : null}
                  {invoice.school.addressLine2 ? <div>{invoice.school.addressLine2}</div> : null}
                  {invoice.school.city ? <div>{invoice.school.city}</div> : null}

                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {invoice.school.phone ? <span>{invoice.school.phone}</span> : null}
                    {invoice.school.email ? <span>{invoice.school.email}</span> : null}
                    {invoice.school.website ? <span>{invoice.school.website}</span> : null}
                  </div>

                  {invoice.school.financeSettings?.financeContactName ||
                  invoice.school.financeSettings?.financeContactEmail ||
                  invoice.school.financeSettings?.financeContactPhone ? (
                    <div className="pt-2">
                      Finance contact:{" "}
                      {invoice.school.financeSettings.financeContactName ?? ""}
                      {invoice.school.financeSettings.financeContactPhone
                        ? ` - ${invoice.school.financeSettings.financeContactPhone}`
                        : ""}
                      {invoice.school.financeSettings.financeContactEmail
                        ? ` - ${invoice.school.financeSettings.financeContactEmail}`
                        : ""}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="text-right">
                <SchoolBadge tone={statusTone(invoice.invoiceStatus)}>
                  {invoice.invoiceStatus}
                </SchoolBadge>

                <div className="mt-3 text-sm text-muted-foreground">
                  Issue date: {invoice.issueDate}
                </div>

                <div className="text-sm text-muted-foreground">
                  Due date: {invoice.dueDate ?? "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-b border-border py-6 md:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Bill To
              </div>

              <div className="mt-1 text-xl font-bold text-foreground">
                {invoice.student
                  ? `${invoice.student.firstName ?? ""} ${invoice.student.lastName ?? ""}`
                  : "No student"}
              </div>

              {invoice.student ? (
                <div className="mt-1 text-sm text-muted-foreground">
                  {invoice.student.code ?? "Code pending"}
                </div>
              ) : null}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Invoice ID
              </div>

              <div className="mt-1 break-all text-sm font-medium text-foreground">
                {invoice.id}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Currency
              </div>

              <div className="mt-1 text-xl font-bold text-foreground">
                {invoice.currencyCode}
              </div>
            </div>
          </div>

          <div className="grid gap-4 py-6 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-surface p-5 print:bg-white">
              <div className="text-sm text-muted-foreground">Subtotal</div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {money(invoice.subtotalAmount, invoice.currencyCode)}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 print:bg-white">
              <div className="text-sm text-muted-foreground">Discount</div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {money(invoice.discountAmount, invoice.currencyCode)}
              </div>
            </div>

            <div className="rounded-2xl border border-success/40 bg-success-subtle p-5 print:bg-white">
              <div className="text-sm text-success">Paid</div>
              <div className="mt-2 text-2xl font-bold text-success">
                {money(invoice.amountPaid, invoice.currencyCode)}
              </div>
            </div>

            <div className="rounded-2xl border border-warning/40 bg-warning-subtle p-5 print:bg-white">
              <div className="text-sm text-warning">Balance</div>
              <div className="mt-2 text-2xl font-bold text-warning">
                {money(invoice.balanceDue, invoice.currencyCode)}
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Invoice Items
            </h2>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-muted text-left text-muted-foreground print:bg-white">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Unit Amount</th>
                    <th className="px-4 py-3">Line Total</th>
                  </tr>
                </thead>

                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {item.description}
                      </td>
                      <td className="px-4 py-3">{item.quantity}</td>
                      <td className="px-4 py-3">
                        {money(item.unitAmount, invoice.currencyCode)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {money(item.lineTotal, invoice.currencyCode)}
                      </td>
                    </tr>
                  ))}

                  {invoice.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No invoice items found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-border p-5">
            <h2 className="text-lg font-semibold text-foreground">Totals</h2>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">
                  {money(invoice.subtotalAmount, invoice.currencyCode)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium text-foreground">
                  {money(invoice.discountAmount, invoice.currencyCode)}
                </span>
              </div>

              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold text-foreground">
                  {money(invoice.totalAmount, invoice.currencyCode)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium text-success">
                  {money(invoice.amountPaid, invoice.currencyCode)}
                </span>
              </div>

              <div className="flex justify-between gap-4 border-t border-border pt-2 text-lg">
                <span className="font-bold text-foreground">Balance Due</span>
                <span className="font-bold text-warning">
                  {money(invoice.balanceDue, invoice.currencyCode)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Payment History
            </h2>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-muted text-left text-muted-foreground print:bg-white">
                  <tr>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Receipt</th>
                  </tr>
                </thead>

                <tbody>
                  {<PaginatedCollection items={invoice.payments} rows columns={7}>{(payment) => (
                    <tr key={payment.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">
                        {payment.paymentNumber ?? payment.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">{payment.paymentDate}</td>
                      <td className="px-4 py-3">
                        <SchoolBadge tone={statusTone(payment.paymentStatus)}>
                          {payment.paymentStatus}
                        </SchoolBadge>
                      </td>
                      <td className="px-4 py-3">{payment.method ?? "-"}</td>
                      <td className="px-4 py-3">{payment.reference ?? "-"}</td>
                      <td className="px-4 py-3 font-semibold">
                        {money(payment.amount, invoice.currencyCode)}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/finance/payments/${payment.id}/receipt`}
                          className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary"
                        >
                          Receipt
                        </a>

                        <a
                          href={`/finance/payments/${payment.id}/receipt/thermal`}
                          className="ml-2 rounded-lg border border-input px-3 py-2 text-xs hover:bg-surface print:hidden"
                        >
                          80mm
                        </a>
                      </td>
                    </tr>
                  )}</PaginatedCollection>}

                  {invoice.payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No payments recorded for this invoice.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {invoice.notes ? (
            <div className="mt-8 rounded-2xl border border-border p-5">
              <div className="text-sm font-semibold text-foreground">Notes</div>
              <p className="mt-2 text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          ) : null}

          <div className="mt-10 grid gap-8 border-t border-border pt-10 md:grid-cols-2">
            <div className="h-24 border-t border-input pt-2 text-center text-sm text-muted-foreground">
              Finance Officer
            </div>

            <div className="h-24 border-t border-input pt-2 text-center text-sm text-muted-foreground">
              Parent / Guardian
            </div>
          </div>
          {invoice.school.financeSettings?.invoiceFooterI18n?.en ||
          invoice.school.financeSettings?.invoiceFooterI18n?.fr ? (
            <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
              {invoice.school.financeSettings.invoiceFooterI18n.en ??
                invoice.school.financeSettings.invoiceFooterI18n.fr}
            </div>
          ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
