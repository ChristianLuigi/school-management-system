"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type PersonSummary = {
  id: string;
  fullName: string;
};

type ApprovalRun = {
  id: string;
  payrollNumber: string | null;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  currencyCode: string;
  totalGross: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNet: number;
  staffCount: number;
  runVersion: number;
  contentChecksum: string;
  preparedBy: PersonSummary | null;
  reviewedBy: PersonSummary | null;
  pendingApprovalAt: string | null;
};

type ApprovalInboxResponse = {
  runs: ApprovalRun[];
  count: number;
};

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

function money(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function shortChecksum(value: string) {
  if (value.length <= 20) return value;
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

export function PayrollApprovalInboxClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const [inbox, setInbox] = useState<ApprovalInboxResponse>({
    runs: [],
    count: 0,
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({ schoolId });
      const response = await fetch(
        `/api/finance/payroll/approval-inbox?${query.toString()}`,
        { cache: "no-store" },
      );
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(body?.message ?? "Failed to load payroll approvals.");
      }

      setInbox({
        runs: Array.isArray(body?.runs) ? body.runs : [],
        count:
          typeof body?.count === "number"
            ? body.count
            : Array.isArray(body?.runs)
              ? body.runs.length
              : 0,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to load payroll approvals.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  async function decide(
    run: ApprovalRun,
    targetStatus: "APPROVED" | "DRAFT",
  ) {
    const note = notes[run.id]?.trim() ?? "";

    if (targetStatus === "DRAFT" && !note) {
      setError("Explain what must be corrected before returning the payroll.");
      return;
    }

    const label =
      targetStatus === "APPROVED"
        ? "approve this exact payroll version"
        : "return this payroll for correction";
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;

    setBusy(`${run.id}-${targetStatus}`);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/finance/payroll/runs/${encodeURIComponent(run.id)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            schoolId,
            targetStatus,
            note: note || undefined,
          }),
        },
      );
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(body?.message ?? "Failed to record the payroll decision.");
      }

      setNotes((current) => ({ ...current, [run.id]: "" }));
      setMessage(
        targetStatus === "APPROVED"
          ? `${run.payrollNumber ?? "Payroll"} approved.`
          : `${run.payrollNumber ?? "Payroll"} returned for correction.`,
      );
      await loadInbox();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to record the payroll decision.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            School Admin approval inbox · {inbox.count}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Review totals, staff coverage, preparer and reviewer identities,
            and the immutable payroll fingerprint before making a decision.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadInbox()}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh inbox"}
        </button>
      </div>

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {!loading && inbox.runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div className="font-semibold text-slate-900">
            No payroll is waiting for approval
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Reviewed payroll runs appear here after they are sent to the School
            Admin.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {inbox.runs.map((run) => (
          <article
            key={run.id}
            className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-950">
                    {run.payrollNumber ?? "Payroll run"}
                  </h3>
                  <SchoolBadge tone="amber">PENDING APPROVAL</SchoolBadge>
                </div>
                <p className="mt-1 text-sm text-slate-700">{run.periodLabel}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {run.periodStart ?? "No start date"} to{" "}
                  {run.periodEnd ?? "no end date"} · {run.currencyCode}
                </p>
              </div>
              <Link
                href={`/finance/payroll/runs/${encodeURIComponent(run.id)}`}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Inspect full payroll
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Staff", String(run.staffCount)],
                ["Gross", money(run.totalGross, run.currencyCode)],
                ["Allowances", money(run.totalAllowances, run.currencyCode)],
                ["Deductions", money(run.totalDeductions, run.currencyCode)],
                ["Net payroll", money(run.totalNet, run.currencyCode)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 font-semibold text-slate-950">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Separation of duties
                </div>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Prepared by</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {run.preparedBy?.fullName ?? "Not recorded"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Reviewed by</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {run.reviewedBy?.fullName ?? "Not recorded"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Waiting since</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {dateTime(run.pendingApprovalAt)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Version being approved
                </div>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Run version</dt>
                    <dd className="font-mono font-semibold text-slate-900">
                      v{run.runVersion}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Content checksum</dt>
                    <dd
                      className="break-all text-right font-mono text-xs text-slate-900"
                      title={run.contentChecksum}
                    >
                      {shortChecksum(run.contentChecksum)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-500">
                  A payroll content change invalidates the review and approval
                  and creates a new version.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm">
              <span className="font-medium text-slate-900">Decision note</span>
              <textarea
                value={notes[run.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [run.id]: event.target.value,
                  }))
                }
                placeholder="Approval comment, or required correction instructions"
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-slate-500">
                A correction note is required when returning a payroll.
              </span>
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void decide(run, "APPROVED")}
                className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
              >
                {busy === `${run.id}-APPROVED`
                  ? "Approving…"
                  : "Approve this payroll"}
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void decide(run, "DRAFT")}
                className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {busy === `${run.id}-DRAFT`
                  ? "Returning…"
                  : "Return for correction"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
