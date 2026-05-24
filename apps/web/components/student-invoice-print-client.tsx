"use client";

import { FinanceInvoiceDetailClient } from "@/components/finance-invoice-detail-client";

export function StudentInvoicePrintClient({
  schoolId,
  invoiceId,
}: {
  schoolId: string;
  invoiceId: string;
}) {
  return <FinanceInvoiceDetailClient schoolId={schoolId} invoiceId={invoiceId} />;
}