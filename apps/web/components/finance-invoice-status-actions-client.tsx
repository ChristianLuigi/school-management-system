"use client";

import { useState } from "react";

export function FinanceInvoiceStatusActionsClient({
  schoolId,
  invoiceId,
  invoiceStatus,
  amountPaid,
  canIssue,
  canVoid,
  onChanged,
}: {
  schoolId: string;
  invoiceId: string;
  invoiceStatus: string;
  amountPaid: number;
  canIssue: boolean;
  canVoid: boolean;
  onChanged: () => void;
}) {
  const [voidReason, setVoidReason] = useState("");
  const [showVoidReason, setShowVoidReason] = useState(false);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function issueInvoice() {
    setWorking("issue");
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schoolId }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to issue invoice.");
      }

      setMessage("Invoice issued successfully.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue invoice.");
    } finally {
      setWorking("");
    }
  }

  async function voidInvoice() {
    setWorking("void");
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/void`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          reason: voidReason,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to void invoice.");
      }

      setMessage("Invoice voided successfully.");
      setShowVoidReason(false);
      setVoidReason("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to void invoice.");
    } finally {
      setWorking("");
    }
  }

  const issueAvailable = canIssue && invoiceStatus === "DRAFT";
  const voidAvailable =
    canVoid &&
    invoiceStatus !== "VOID" && invoiceStatus !== "PAID" && amountPaid <= 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 print:hidden">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Invoice Actions
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Issue draft invoices or void invoices that have no recorded payments.
        </p>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-success/40 bg-success-subtle p-3 text-sm text-success">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {issueAvailable ? (
          <button
            type="button"
            disabled={working === "issue"}
            onClick={issueInvoice}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
          >
            {working === "issue" ? "Issuing..." : "Issue Invoice"}
          </button>
        ) : null}

        {voidAvailable ? (
          <button
            type="button"
            disabled={working === "void"}
            onClick={() => setShowVoidReason((value) => !value)}
            className="rounded-xl border border-danger/40 px-4 py-3 text-sm font-medium text-danger hover:bg-danger-subtle disabled:opacity-60"
          >
            Void Invoice
          </button>
        ) : null}

        {!issueAvailable && !voidAvailable ? (
          <div className="rounded-xl bg-surface p-3 text-sm text-muted-foreground">
            No status action is available for this invoice.
          </div>
        ) : null}
      </div>

      {showVoidReason ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-danger/40 bg-danger-subtle p-4">
          <div className="text-sm font-semibold text-danger">
            Confirm invoice void
          </div>

          <p className="text-sm text-danger">
            Voiding an invoice is a serious action. It is only allowed when no
            payments have been recorded.
          </p>

          <textarea
            className="w-full rounded-xl border border-danger/40 bg-surface px-3 py-2 text-sm"
            placeholder="Reason for voiding this invoice"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />

          <button
            type="button"
            disabled={working === "void"}
            onClick={voidInvoice}
            className="rounded-xl bg-danger px-4 py-3 text-sm font-medium text-danger-foreground hover:bg-danger disabled:opacity-60"
          >
            {working === "void" ? "Voiding..." : "Confirm Void"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
