"use client";

import { FinancePaymentReceiptClient } from "@/components/finance-payment-receipt-client";

export function StudentPaymentReceiptClient({
  schoolId,
  paymentId,
}: {
  schoolId: string;
  paymentId: string;
}) {
  return (
    <FinancePaymentReceiptClient schoolId={schoolId} paymentId={paymentId} />
  );
}