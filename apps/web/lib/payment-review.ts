export function validatePaymentReview(input: {
  amount: string;
  balanceDue: number;
  invoiceCurrency: string;
  sessionCurrency: string;
  method: string;
  enabledMethods: string[];
  reference: string;
}) {
  if (input.invoiceCurrency !== input.sessionCurrency) return "currency";
  if (
    !/^\d+(?:\.\d{1,2})?$/.test(input.amount.trim()) ||
    !Number.isFinite(Number(input.amount)) ||
    Number(input.amount) <= 0
  )
    return "amount";
  if (
    Math.round(Number(input.amount) * 100) > Math.round(input.balanceDue * 100)
  )
    return "overpayment";
  if (!input.enabledMethods.includes(input.method)) return "method";
  if (input.method !== "CASH" && !input.reference.trim()) return "reference";
  return null;
}
