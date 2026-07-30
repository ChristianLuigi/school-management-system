"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type Person = {
  firstName: string | null;
  lastName: string | null;
  email?: string;
};

type PaymentCorrection = {
  id: string;
  kind: "PAYMENT_CORRECTION";
  paymentId: string;
  paymentNumber: string | null;
  paymentMethod: string | null;
  invoiceId: string;
  invoiceNumber: string | null;
  correctionType: "REVERSAL" | "REFUND";
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "COMPLETED";
  amount: number;
  currencyCode: string;
  reason: string;
  requestedByUserId: string;
  requestedBy: Person;
  requestedAt: string;
  reviewedBy: Person | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  processedBy: Person | null;
  processedAt: string | null;
  refundMethod: string | null;
  refundReference: string | null;
};

type CreditNote = {
  id: string;
  kind: "CREDIT_NOTE";
  invoiceId: string;
  invoiceNumber: string | null;
  creditNoteNumber: string;
  status: "PENDING_REVIEW" | "APPLIED" | "REJECTED";
  amount: number;
  currencyCode: string;
  reason: string;
  requestedByUserId: string;
  requestedBy: Person;
  requestedAt: string;
  reviewedBy: Person | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

type CorrectionsResponse = {
  paymentCorrections: PaymentCorrection[];
  creditNotes: CreditNote[];
  currentUserId: string;
  capabilities: {
    canApprove: boolean;
    canRequestPaymentCorrection: boolean;
    canRequestCreditNote: boolean;
    canProcessPaymentCorrection: boolean;
  };
};

const EMPTY_DATA: CorrectionsResponse = {
  paymentCorrections: [],
  creditNotes: [],
  currentUserId: "",
  capabilities: {
    canApprove: false,
    canRequestPaymentCorrection: false,
    canRequestCreditNote: false,
    canProcessPaymentCorrection: false,
  },
};

const REFUND_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CHECK",
  "MOBILE_MONEY",
  "CARD",
  "OTHER",
] as const;

function personName(person: Person | null) {
  if (!person) return "—";
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ") ||
    person.email ||
    "Unknown user"
  );
}

function money(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function idempotencyKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

export function FinanceCorrectionsClient({
  schoolId,
  initialPaymentId,
  initialInvoiceId,
}: {
  schoolId: string;
  initialPaymentId?: string;
  initialInvoiceId?: string;
}) {
  const [data, setData] = useState<CorrectionsResponse>(EMPTY_DATA);
  const [status, setStatus] = useState("");
  const [paymentId, setPaymentId] = useState(initialPaymentId ?? "");
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId ?? "");
  const [correctionType, setCorrectionType] =
    useState<"REVERSAL" | "REFUND">("REVERSAL");
  const [paymentReason, setPaymentReason] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refundMethods, setRefundMethods] = useState<Record<string, string>>(
    {},
  );
  const [refundReferences, setRefundReferences] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadCorrections = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ schoolId });
      if (status) params.set("status", status);
      const response = await fetch(
        `/api/finance/corrections?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to load corrections.");
      }
      setData(body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load corrections.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, status]);

  useEffect(() => {
    void loadCorrections();
  }, [loadCorrections]);

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message ?? "The finance action failed.");
    }
    return payload;
  }

  async function requestPaymentCorrection(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const targetPaymentId = paymentId.trim();
    setBusy("request-payment");
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/finance/payments/${encodeURIComponent(targetPaymentId)}/corrections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey("payment-correction"),
          },
          body: JSON.stringify({
            schoolId,
            correctionType,
            reason: paymentReason.trim(),
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          body?.message ?? "Unable to request the payment correction.",
        );
      }
      setPaymentReason("");
      setMessage(
        "The payment correction is awaiting independent approval.",
      );
      await loadCorrections();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to request the payment correction.",
      );
    } finally {
      setBusy("");
    }
  }

  async function requestCreditNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetInvoiceId = invoiceId.trim();
    setBusy("request-credit");
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/finance/invoices/${encodeURIComponent(targetInvoiceId)}/credit-notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey("credit-note"),
          },
          body: JSON.stringify({
            schoolId,
            amount: Number(creditAmount),
            reason: creditReason.trim(),
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to request the credit note.");
      }
      setCreditAmount("");
      setCreditReason("");
      setMessage("The credit note is awaiting independent approval.");
      await loadCorrections();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to request the credit note.",
      );
    } finally {
      setBusy("");
    }
  }

  async function review(
    kind: "payment-corrections" | "credit-notes",
    id: string,
    decision: "approve" | "reject",
  ) {
    setBusy(`${decision}:${id}`);
    setMessage("");
    setError("");
    try {
      await post(`/api/finance/${kind}/${encodeURIComponent(id)}/${decision}`, {
        schoolId,
        reviewNote: notes[id]?.trim() || undefined,
      });
      setMessage(
        decision === "approve"
          ? "The correction was approved."
          : "The correction was rejected.",
      );
      await loadCorrections();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to review request.",
      );
    } finally {
      setBusy("");
    }
  }

  async function processCorrection(correction: PaymentCorrection) {
    setBusy(`process:${correction.id}`);
    setMessage("");
    setError("");
    try {
      const refundMethod =
        correction.correctionType === "REFUND"
          ? refundMethods[correction.id] || "CASH"
          : undefined;
      let cashierSessionId: string | undefined;
      if (refundMethod === "CASH") {
        const params = new URLSearchParams({
          schoolId,
          currencyCode: correction.currencyCode,
        });
        const response = await fetch(
          `/api/finance/cashier/session?${params.toString()}`,
          { cache: "no-store" },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to load cashier session.");
        }
        if (!body?.session || body.session.status !== "OPEN") {
          throw new Error(
            `Open a ${correction.currencyCode} cashier session before processing a cash refund.`,
          );
        }
        cashierSessionId = body.session.id;
      }
      await post(
        `/api/finance/payment-corrections/${encodeURIComponent(correction.id)}/process`,
        {
          schoolId,
          refundMethod,
          refundReference:
            refundMethod && refundMethod !== "CASH"
              ? refundReferences[correction.id]?.trim()
              : undefined,
          cashierSessionId,
        },
      );
      setMessage(
        correction.correctionType === "REFUND"
          ? "The refund was recorded and the invoice was recalculated."
          : "The payment was reversed and the invoice was recalculated.",
      );
      await loadCorrections();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to process correction.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-2">
        {data.capabilities.canRequestPaymentCorrection ? (
          <form
            onSubmit={requestPaymentCorrection}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-lg font-semibold text-slate-950">
              Request a payment correction
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Use reversal for an erroneous record and refund when money is
              returned. The original payment remains in the audit history.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Payment ID
                <input
                  required
                  value={paymentId}
                  onChange={(event) => setPaymentId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Correction
                <select
                  value={correctionType}
                  onChange={(event) =>
                    setCorrectionType(
                      event.target.value as "REVERSAL" | "REFUND",
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="REVERSAL">Reverse erroneous payment</option>
                  <option value="REFUND">Refund payment</option>
                </select>
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Reason
              <textarea
                required
                minLength={10}
                maxLength={1000}
                value={paymentReason}
                onChange={(event) => setPaymentReason(event.target.value)}
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={
                busy === "request-payment" ||
                !paymentId.trim() ||
                paymentReason.trim().length < 10
              }
              className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Submit for approval
            </button>
          </form>
        ) : null}

        {data.capabilities.canRequestCreditNote ? (
          <form
            onSubmit={requestCreditNote}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-lg font-semibold text-slate-950">
              Request an invoice credit note
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              A credit note reduces the unpaid invoice balance only after an
              independent reviewer approves it.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Invoice ID
                <input
                  required
                  value={invoiceId}
                  onChange={(event) => setInvoiceId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Credit amount
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={creditAmount}
                  onChange={(event) => setCreditAmount(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Reason
              <textarea
                required
                minLength={10}
                maxLength={1000}
                value={creditReason}
                onChange={(event) => setCreditReason(event.target.value)}
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={
                busy === "request-credit" ||
                !invoiceId.trim() ||
                Number(creditAmount) <= 0 ||
                creditReason.trim().length < 10
              }
              className="mt-4 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Submit credit note
            </button>
          </form>
        ) : null}
      </section>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="font-semibold text-slate-950">
              Controlled correction register
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Request, review, and settlement steps are permanently auditable.
            </p>
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="PENDING_REVIEW">Pending review</option>
            <option value="APPROVED">Approved for processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="APPLIED">Credit applied</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div className="space-y-4 p-4">
          {loading ? (
            <div className="text-sm text-slate-500">Loading corrections…</div>
          ) : null}

          {data.paymentCorrections.map((correction) => {
            const canReview =
              correction.status === "PENDING_REVIEW" &&
              data.capabilities.canApprove &&
              correction.requestedByUserId !== data.currentUserId;
            const canProcess =
              correction.status === "APPROVED" &&
              data.capabilities.canProcessPaymentCorrection;
            const refundMethod =
              refundMethods[correction.id] || "CASH";
            return (
              <article
                key={correction.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-slate-950">
                        {correction.correctionType === "REFUND"
                          ? "Payment refund"
                          : "Payment reversal"}
                      </strong>
                      <SchoolBadge>{correction.status}</SchoolBadge>
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      Payment{" "}
                      <Link
                        href={`/finance/payments/${correction.paymentId}/receipt`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {correction.paymentNumber ?? correction.paymentId}
                      </Link>{" "}
                      · {money(correction.amount, correction.currencyCode)}
                    </div>
                    <div className="mt-2 text-sm text-slate-800">
                      {correction.reason}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Requested by {personName(correction.requestedBy)} ·{" "}
                      {dateTime(correction.requestedAt)}
                    </div>
                    {correction.reviewedAt ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Reviewed by {personName(correction.reviewedBy)} ·{" "}
                        {dateTime(correction.reviewedAt)}
                      </div>
                    ) : null}
                    {correction.processedAt ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Processed by {personName(correction.processedBy)} ·{" "}
                        {dateTime(correction.processedAt)}
                      </div>
                    ) : null}
                  </div>
                  <Link
                    href={`/finance/invoices/${correction.invoiceId}`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    Invoice {correction.invoiceNumber ?? "details"}
                  </Link>
                </div>

                {canReview ? (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <input
                      value={notes[correction.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [correction.id]: event.target.value,
                        }))
                      }
                      placeholder="Review note; required for rejection"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void review(
                            "payment-corrections",
                            correction.id,
                            "approve",
                          )
                        }
                        disabled={busy.endsWith(correction.id)}
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void review(
                            "payment-corrections",
                            correction.id,
                            "reject",
                          )
                        }
                        disabled={
                          busy.endsWith(correction.id) ||
                          (notes[correction.id]?.trim().length ?? 0) < 10
                        }
                        className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : null}

                {canProcess ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    {correction.correctionType === "REFUND" ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <select
                          value={refundMethod}
                          onChange={(event) =>
                            setRefundMethods((current) => ({
                              ...current,
                              [correction.id]: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                        >
                          {REFUND_METHODS.map((method) => (
                            <option key={method} value={method}>
                              {method.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                        {refundMethod !== "CASH" ? (
                          <input
                            value={refundReferences[correction.id] ?? ""}
                            onChange={(event) =>
                              setRefundReferences((current) => ({
                                ...current,
                                [correction.id]: event.target.value,
                              }))
                            }
                            placeholder="Refund transaction reference"
                            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                          />
                        ) : (
                          <div className="text-xs text-amber-900">
                            The current user’s open{" "}
                            {correction.currencyCode} cashier session will be
                            used.
                          </div>
                        )}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void processCorrection(correction)}
                      disabled={
                        busy === `process:${correction.id}` ||
                        (correction.correctionType === "REFUND" &&
                          refundMethod !== "CASH" &&
                          (refundReferences[correction.id]?.trim().length ??
                            0) < 3)
                      }
                      className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {correction.correctionType === "REFUND"
                        ? "Record refund"
                        : "Complete reversal"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}

          {data.creditNotes.map((credit) => {
            const canReview =
              credit.status === "PENDING_REVIEW" &&
              data.capabilities.canApprove &&
              credit.requestedByUserId !== data.currentUserId;
            return (
              <article
                key={credit.id}
                className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-slate-950">
                        Credit note {credit.creditNoteNumber}
                      </strong>
                      <SchoolBadge>{credit.status}</SchoolBadge>
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {money(credit.amount, credit.currencyCode)} · Invoice{" "}
                      {credit.invoiceNumber ?? credit.invoiceId}
                    </div>
                    <div className="mt-2 text-sm text-slate-800">
                      {credit.reason}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Requested by {personName(credit.requestedBy)} ·{" "}
                      {dateTime(credit.requestedAt)}
                    </div>
                  </div>
                  <Link
                    href={`/finance/invoices/${credit.invoiceId}`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    Open invoice
                  </Link>
                </div>
                {canReview ? (
                  <div className="mt-4 rounded-xl bg-white p-3">
                    <input
                      value={notes[credit.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [credit.id]: event.target.value,
                        }))
                      }
                      placeholder="Review note; required for rejection"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void review("credit-notes", credit.id, "approve")
                        }
                        disabled={busy.endsWith(credit.id)}
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Approve and apply
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void review("credit-notes", credit.id, "reject")
                        }
                        disabled={
                          busy.endsWith(credit.id) ||
                          (notes[credit.id]?.trim().length ?? 0) < 10
                        }
                        className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}

          {!loading &&
          !data.paymentCorrections.length &&
          !data.creditNotes.length ? (
            <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              No correction records match this filter.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
