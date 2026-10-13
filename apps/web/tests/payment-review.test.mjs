import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePaymentReview } from "../lib/payment-review.ts";
const valid = {
  amount: "25.50",
  balanceDue: 100,
  invoiceCurrency: "HTG",
  sessionCurrency: "HTG",
  method: "CASH",
  enabledMethods: ["CASH", "BANK_TRANSFER"],
  reference: "",
};
test("accepts partial and full payments in invoice currency", () => {
  assert.equal(validatePaymentReview(valid), null);
  assert.equal(validatePaymentReview({ ...valid, amount: "100" }), null);
});
test("rejects overpayment and mismatched cash drawer currency", () => {
  assert.equal(
    validatePaymentReview({ ...valid, amount: "100.01" }),
    "overpayment",
  );
  assert.equal(
    validatePaymentReview({ ...valid, sessionCurrency: "USD" }),
    "currency",
  );
});
test("rejects invalid or overly precise payment amounts", () => {
  for (const amount of ["", "0", "-1", "1.234", "NaN", "Infinity", "1e2"])
    assert.equal(validatePaymentReview({ ...valid, amount }), "amount");
});
test("requires enabled method and a non-cash reference", () => {
  assert.equal(validatePaymentReview({ ...valid, method: "CARD" }), "method");
  assert.equal(
    validatePaymentReview({
      ...valid,
      method: "BANK_TRANSFER",
      reference: " ",
    }),
    "reference",
  );
  assert.equal(
    validatePaymentReview({
      ...valid,
      method: "BANK_TRANSFER",
      reference: "TX-123",
    }),
    null,
  );
});
