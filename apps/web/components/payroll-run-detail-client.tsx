"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SchoolBadge, type SchoolBadgeTone } from "@/components/school-ui";

type AdjustmentType = "ALLOWANCE" | "DEDUCTION";
type AdjustmentLine = { id: string; type: AdjustmentType; code: string; description: string; amount: number };
type Reversal = { id: string; reason: string; originalPaidAt: string | null; originalPaymentMethod: string | null; originalPaymentReference: string | null; reversedAt: string };
type PayrollItem = {
  id: string;
  payrollStaffProfileId: string;
  staffAccountId: string;
  grossSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paymentStatus: string;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  staff: { fullName: string; staffCode: string | null; positionTitle: string | null; department: string | null; employmentType: string; payFrequency: string; currencyCode: string; baseSalary?: number };
  snapshot?: { fullName?: string; staffCode?: string | null; positionTitle?: string | null; department?: string | null; employmentType?: string; payFrequency?: string; currencyCode?: string; baseSalary?: number };
  adjustmentLines?: AdjustmentLine[];
  reversals?: Reversal[];
};
type PayrollStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "CLOSED";
type Capabilities = {
  canEditAdjustments: boolean;
  canSubmitForReview: boolean;
  canCompleteReview: boolean;
  canReturnToDraft: boolean;
  canApprove: boolean;
  canStartProcessing: boolean;
  canMarkPayments: boolean;
  canClose: boolean;
  canReversePayments: boolean;
};
type RunDetails = {
  run: { id: string; payrollNumber: string | null; periodLabel: string; periodStart: string | null; periodEnd: string | null; payrollStatus: string; currencyCode: string; totalGross: number; totalAllowances: number; totalDeductions: number; totalNet: number; notes: string | null; runVersion?: number; contentChecksum?: string | null; preparedByUserId?: string | null; preparedAt?: string | null; submittedForReviewByUserId?: string | null; submittedForReviewAt?: string | null; reviewedByUserId?: string | null; reviewedAt?: string | null; pendingApprovalAt?: string | null; approvedByUserId?: string | null; approvedAt?: string | null; processedByUserId?: string | null; processingStartedAt?: string | null; paidAt?: string | null; closedByUserId?: string | null; closedAt?: string | null; separationOverrideReason?: string | null; createdAt: string };
  items: PayrollItem[];
  events?: Array<{ id: string; eventType: string; fromStatus: string | null; toStatus: string | null; actorUserId: string | null; note: string | null; createdAt: string }>;
  actor?: { userId: string; roleCodes: string[]; permissions: string[]; isSchoolAdmin: boolean; isFinanceAdmin: boolean };
  capabilities?: Partial<Capabilities>;
};
type Register = {
  run: { payrollNumber: string | null; periodLabel: string; periodStart: string | null; periodEnd: string | null; payrollStatus: string; currencyCode: string };
  summary: { staffCount: number; paidCount: number; pendingCount: number; reversedCount: number; totalGross: number; totalAllowances: number; totalDeductions: number; totalNet: number };
  entries: Array<{ payrollItemId: string; staffCode: string | null; fullName: string; positionTitle: string | null; grossSalary: number; allowances: number; deductions: number; netSalary: number; paymentStatus: string; paidAt: string | null; paymentMethod: string | null; paymentReference: string | null }>;
};
type DraftLine = { code: string; description: string; amount: string };

const EMPTY_CAPABILITIES: Capabilities = { canEditAdjustments: false, canSubmitForReview: false, canCompleteReview: false, canReturnToDraft: false, canApprove: false, canStartProcessing: false, canMarkPayments: false, canClose: false, canReversePayments: false };

function money(value: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value); }
function tone(status: string): SchoolBadgeTone {
  if (["PAID", "CLOSED"].includes(status)) return "green";
  if (["APPROVED", "PROCESSING"].includes(status)) return "blue";
  if (["PENDING", "DRAFT", "UNDER_REVIEW", "PENDING_APPROVAL", "REVIEWED"].includes(status)) return "amber";
  if (["CANCELLED", "REVERSED"].includes(status)) return "red";
  return "neutral";
}
function dateTime(value: string | null | undefined) { return value ? new Date(value).toLocaleString() : "-"; }
async function json(response: Response) { return response.json().catch(() => null); }
function draftLines(lines: AdjustmentLine[] | undefined, type: AdjustmentType): DraftLine[] {
  return (lines ?? []).filter((line) => line.type === type).map((line) => ({ code: line.code, description: line.description, amount: String(line.amount) }));
}

export function PayrollRunDetailClient({
  schoolId,
  runId,
  isSchoolAdmin,
}: {
  schoolId: string;
  runId: string;
  isSchoolAdmin: boolean;
}) {
  const [details, setDetails] = useState<RunDetails | null>(null);
  const [register, setRegister] = useState<Register | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [transitionNote, setTransitionNote] = useState("");
  const [paymentItemId, setPaymentItemId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [adjustmentItemId, setAdjustmentItemId] = useState("");
  const [allowances, setAllowances] = useState<DraftLine[]>([]);
  const [deductions, setDeductions] = useState<DraftLine[]>([]);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [reversalItemId, setReversalItemId] = useState("");
  const [reversalReason, setReversalReason] = useState("");

  const capabilities = { ...EMPTY_CAPABILITIES, ...(details?.capabilities ?? {}) };
  const locked = details?.run.payrollStatus === "CLOSED";

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ schoolId });
      const response = await fetch(`/api/finance/payroll/runs/${runId}?${query}`, { cache: "no-store" });
      const body = await json(response);
      if (!response.ok) throw new Error(body?.message ?? "Failed to load payroll run.");
      setDetails(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load payroll run.");
    } finally { setLoading(false); }
  }, [runId, schoolId]);

  useEffect(() => void loadDetails(), [loadDetails]);

  async function transition(targetStatus: PayrollStatus, label: string) {
    if (targetStatus === "DRAFT" && !transitionNote.trim()) {
      setError("Explain what must be corrected before returning the payroll.");
      return;
    }
    if (!window.confirm(`${label}?`)) return;
    setBusy(`status-${targetStatus}`); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/finance/payroll/runs/${runId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ schoolId, targetStatus, note: transitionNote.trim() || undefined }),
      });
      const body = await json(response);
      if (!response.ok) throw new Error(body?.message ?? "Failed to update payroll status.");
      if (body?.run && body?.items) setDetails(body); else await loadDetails();
      setTransitionNote(""); setMessage(`${label} completed.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to update payroll status."); }
    finally { setBusy(""); }
  }

  function openAdjustments(item: PayrollItem) {
    if (adjustmentItemId === item.id) { setAdjustmentItemId(""); return; }
    setAdjustmentItemId(item.id);
    setAllowances(draftLines(item.adjustmentLines, "ALLOWANCE"));
    setDeductions(draftLines(item.adjustmentLines, "DEDUCTION"));
    setAdjustmentReason("");
  }

  function updateLine(type: AdjustmentType, index: number, field: keyof DraftLine, value: string) {
    const setter = type === "ALLOWANCE" ? setAllowances : setDeductions;
    setter((lines) => lines.map((line, current) => current === index ? { ...line, [field]: value } : line));
  }
  function addLine(type: AdjustmentType) {
    const setter = type === "ALLOWANCE" ? setAllowances : setDeductions;
    setter((lines) => [...lines, { code: "", description: "", amount: "" }]);
  }
  function removeLine(type: AdjustmentType, index: number) {
    const setter = type === "ALLOWANCE" ? setAllowances : setDeductions;
    setter((lines) => lines.filter((_, current) => current !== index));
  }

  async function saveAdjustments(itemId: string) {
    const serialize = (lines: DraftLine[]) => lines.map((line) => ({ code: line.code.trim(), description: line.description.trim(), amount: Number(line.amount) }));
    const all = [...allowances, ...deductions];
    if (all.some((line) => !line.code.trim() || !line.description.trim() || !Number.isFinite(Number(line.amount)) || Number(line.amount) <= 0)) {
      setError("Every adjustment needs a code, description, and positive amount."); return;
    }
    setBusy(`adjust-${itemId}`); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/finance/payroll/items/${itemId}/adjustments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ schoolId, reason: adjustmentReason.trim() || undefined, allowances: serialize(allowances), deductions: serialize(deductions) }),
      });
      const body = await json(response);
      if (!response.ok) throw new Error(body?.message ?? "Failed to save adjustments.");
      setAdjustmentItemId(""); setMessage("Allowances and deductions updated."); await loadDetails();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to save adjustments."); }
    finally { setBusy(""); }
  }

  async function markPaid(itemId: string) {
    setBusy(`pay-${itemId}`); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/finance/payroll/items/${itemId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ schoolId, paidAt: paidAt || undefined, paymentMethod, paymentReference: paymentReference.trim() || undefined, notes: paymentNotes.trim() || undefined }),
      });
      const body = await json(response);
      if (!response.ok) throw new Error(body?.message ?? "Failed to mark salary as paid.");
      setPaymentItemId(""); setPaymentMethod("BANK_TRANSFER"); setPaymentReference(""); setPaidAt(""); setPaymentNotes(""); setMessage("Salary marked as paid."); await loadDetails();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to mark salary as paid."); }
    finally { setBusy(""); }
  }

  async function reversePayment(itemId: string) {
    if (!reversalReason.trim()) { setError("A reversal reason is required."); return; }
    if (!window.confirm("Reverse this salary payment and reopen it for processing?")) return;
    setBusy(`reverse-${itemId}`); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/finance/payroll/items/${itemId}/reversal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ schoolId, reason: reversalReason.trim() }),
      });
      const body = await json(response);
      if (!response.ok) throw new Error(body?.message ?? "Failed to reverse payment.");
      setReversalItemId(""); setReversalReason(""); setMessage("Salary payment reversed with an audit record."); await loadDetails();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to reverse payment."); }
    finally { setBusy(""); }
  }

  async function loadRegister() {
    setBusy("register"); setError("");
    try {
      const query = new URLSearchParams({ schoolId });
      const response = await fetch(`/api/finance/payroll/runs/${runId}/payment-register?${query}`, { cache: "no-store" });
      const body = await json(response);
      if (!response.ok) throw new Error(body?.message ?? "Failed to load payment register.");
      setRegister(body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to load payment register."); }
    finally { setBusy(""); }
  }

  const actions = [
    capabilities.canSubmitForReview
      ? { status: "UNDER_REVIEW" as const, label: "Submit for review", tone: "primary" as const }
      : null,
    capabilities.canCompleteReview
      ? { status: "PENDING_APPROVAL" as const, label: "Complete review and send for approval", tone: "primary" as const }
      : null,
    capabilities.canApprove && isSchoolAdmin && details?.actor?.isSchoolAdmin
      ? { status: "APPROVED" as const, label: "Approve payroll", tone: "approve" as const }
      : null,
    capabilities.canReturnToDraft
      ? { status: "DRAFT" as const, label: "Return for correction", tone: "return" as const }
      : null,
    capabilities.canStartProcessing
      ? { status: "PROCESSING" as const, label: "Start processing", tone: "primary" as const }
      : null,
    capabilities.canClose && isSchoolAdmin && details?.actor?.isSchoolAdmin
      ? { status: "CLOSED" as const, label: "Close payroll", tone: "primary" as const }
      : null,
  ].filter((action) => action !== null);
  return (
    <div className="space-y-6">
      <div className="space-y-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/finance/payroll" className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Back to payroll</Link>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadRegister()} disabled={busy === "register"} className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">{busy === "register" ? "Loading register..." : "Payment register"}</button>
            <button type="button" onClick={() => void loadDetails()} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">{loading ? "Loading..." : "Refresh"}</button>
          </div>
        </div>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}
        {!details && !error ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading payroll run...</div> : null}

        {details ? (
          <>
            {locked ? <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><strong>Closed payroll:</strong> salary snapshots, adjustments, and payments are locked. Use a new controlled correction process rather than editing this run.</div> : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-xl font-semibold text-slate-900">{details.run.payrollNumber ?? "Payroll run"}</h2><p className="mt-1 text-sm text-slate-600">{details.run.periodLabel}</p><p className="mt-1 text-xs text-slate-500">{details.run.periodStart ?? "-"} to {details.run.periodEnd ?? "-"} · {details.run.currencyCode}</p></div>
                <SchoolBadge tone={tone(details.run.payrollStatus)}>{details.run.payrollStatus.replaceAll("_", " ")}</SchoolBadge>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[["Staff", details.items.length, false], ["Gross", details.run.totalGross, true], ["Allowances", details.run.totalAllowances, true], ["Deductions", details.run.totalDeductions, true], ["Net payroll", details.run.totalNet, true]].map(([label, value, currency]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-4"><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-xl font-bold">{currency ? money(Number(value), details.run.currencyCode) : Number(value)}</div></div>)}</div>
              <div className="mt-5 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                <div><span className="font-semibold text-slate-800">Prepared:</span> {dateTime(details.run.preparedAt ?? details.run.createdAt)}<div className="mt-1 break-all font-mono text-[11px]">{details.run.preparedByUserId ?? "Actor unavailable"}</div></div>
                <div><span className="font-semibold text-slate-800">Submitted for review:</span> {dateTime(details.run.submittedForReviewAt)}<div className="mt-1 break-all font-mono text-[11px]">{details.run.submittedForReviewByUserId ?? "Actor unavailable"}</div></div>
                <div><span className="font-semibold text-slate-800">Reviewed:</span> {dateTime(details.run.reviewedAt)}<div className="mt-1 break-all font-mono text-[11px]">{details.run.reviewedByUserId ?? "Actor unavailable"}</div></div>
                <div><span className="font-semibold text-slate-800">Pending approval:</span> {dateTime(details.run.pendingApprovalAt)}</div>
                <div><span className="font-semibold text-slate-800">Approved:</span> {dateTime(details.run.approvedAt)}<div className="mt-1 break-all font-mono text-[11px]">{details.run.approvedByUserId ?? "Actor unavailable"}</div></div>
                <div><span className="font-semibold text-slate-800">Processing:</span> {dateTime(details.run.processingStartedAt)}</div>
                <div><span className="font-semibold text-slate-800">Paid:</span> {dateTime(details.run.paidAt)}</div>
                <div><span className="font-semibold text-slate-800">Closed:</span> {dateTime(details.run.closedAt)}</div>
              </div>
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <div className="font-semibold">Payroll content identity</div>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  <span>Run version: <strong>v{details.run.runVersion ?? 1}</strong></span>
                  <span className="break-all font-mono">Checksum: {details.run.contentChecksum ?? "Not available"}</span>
                </div>
                <p className="mt-2 text-xs text-blue-800">Any salary, allowance, deduction, or staff change invalidates the prior review and approval.</p>
              </div>
              {details.run.separationOverrideReason ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>Separation-of-duties override:</strong> {details.run.separationOverrideReason}</div> : null}
            </section>

            {actions.length ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">Workflow action</h3>
                <p className="mt-1 text-sm text-slate-600">Finance staff prepare and review payroll. Only an active School Administrator can grant final approval or close a fully paid run.</p>
                <textarea className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Workflow note; correction instructions are required when returning to draft" value={transitionNote} onChange={(event) => setTransitionNote(event.target.value)} />
                <div className="mt-3 flex flex-wrap gap-2">{actions.map((action) => <button key={action.status} type="button" disabled={Boolean(busy)} onClick={() => void transition(action.status, action.label)} className={`rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60 ${action.tone === "approve" ? "bg-green-700 text-white hover:bg-green-800" : action.tone === "return" ? "border border-red-300 text-red-700 hover:bg-red-50" : "bg-slate-900 text-white hover:bg-slate-800"}`}>{busy === `status-${action.status}` ? "Working..." : action.label}</button>)}</div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div><h3 className="font-semibold text-slate-900">Payroll items</h3><p className="mt-1 text-sm text-slate-600">Salary identity and base pay are snapshots captured when this run was prepared.</p></div>
              <div className="mt-4 space-y-4">
                {details.items.map((item) => {
                  const lines = item.adjustmentLines ?? [];
                  const canPay = capabilities.canMarkPayments && ["PENDING", "REVERSED"].includes(item.paymentStatus);
                  const canReverse = capabilities.canReversePayments && item.paymentStatus === "PAID";
                  return (
                    <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-slate-900">{item.snapshot?.fullName ?? item.staff.fullName}</div><div className="mt-1 text-sm text-slate-600">{item.snapshot?.positionTitle ?? item.staff.positionTitle ?? "No position"}{(item.snapshot?.department ?? item.staff.department) ? ` · ${item.snapshot?.department ?? item.staff.department}` : ""}</div><div className="mt-1 text-xs text-slate-500">{(item.snapshot?.staffCode ?? item.staff.staffCode) ? `Code: ${item.snapshot?.staffCode ?? item.staff.staffCode} · ` : ""}Snapshot</div></div><SchoolBadge tone={tone(item.paymentStatus)}>{item.paymentStatus.replaceAll("_", " ")}</SchoolBadge></div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Gross", item.grossSalary], ["Allowances", item.allowances], ["Deductions", item.deductions], ["Net", item.netSalary]].map(([label, value]) => <div key={String(label)}><div className="text-xs text-slate-500">{label}</div><div className="font-semibold">{money(Number(value), details.run.currencyCode)}</div></div>)}</div>

                      {lines.length ? <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adjustment lines</div><div className="mt-2 space-y-1">{lines.map((line) => <div key={line.id} className="flex flex-wrap justify-between gap-2 text-sm"><span><SchoolBadge tone={line.type === "ALLOWANCE" ? "green" : "amber"}>{line.type}</SchoolBadge><span className="ml-2 font-medium">{line.code}</span> · {line.description}</span><span className="font-semibold">{money(line.amount, details.run.currencyCode)}</span></div>)}</div></div> : null}

                      {item.paidAt ? <div className="mt-3 text-xs text-slate-500">Paid {dateTime(item.paidAt)}{item.paymentMethod ? ` · ${item.paymentMethod.replaceAll("_", " ")}` : ""}{item.paymentReference ? ` · Ref ${item.paymentReference}` : ""}</div> : null}
                      {item.reversals?.length ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">Latest reversal: {item.reversals.at(-1)?.reason} · {dateTime(item.reversals.at(-1)?.reversedAt)}</div> : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/finance/payroll/items/${item.id}/payslip`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">Payslip</Link>
                        {capabilities.canEditAdjustments ? <button type="button" onClick={() => openAdjustments(item)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium">{adjustmentItemId === item.id ? "Close adjustments" : "Edit adjustments"}</button> : null}
                        {canPay ? <button type="button" onClick={() => { setPaymentItemId(paymentItemId === item.id ? "" : item.id); setPaymentReference(""); setPaidAt(""); setPaymentNotes(""); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium">{paymentItemId === item.id ? "Close payment" : "Record payment"}</button> : null}
                        {canReverse ? <button type="button" onClick={() => { setReversalItemId(reversalItemId === item.id ? "" : item.id); setReversalReason(""); }} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700">{reversalItemId === item.id ? "Cancel reversal" : "Reverse payment"}</button> : null}
                      </div>

                      {adjustmentItemId === item.id ? (
                        <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                          {(["ALLOWANCE", "DEDUCTION"] as AdjustmentType[]).map((type) => {
                            const draft = type === "ALLOWANCE" ? allowances : deductions;
                            return <div key={type}><div className="flex items-center justify-between"><h4 className="text-sm font-semibold">{type === "ALLOWANCE" ? "Allowances" : "Deductions"}</h4><button type="button" onClick={() => addLine(type)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">Add line</button></div><div className="mt-2 space-y-2">{draft.map((line, index) => <div key={`${type}-${index}`} className="grid gap-2 md:grid-cols-[0.8fr_1.5fr_0.7fr_auto]"><input className="rounded-lg border border-slate-300 px-2 py-2 text-sm" placeholder="Code" value={line.code} onChange={(event) => updateLine(type, index, "code", event.target.value)} /><input className="rounded-lg border border-slate-300 px-2 py-2 text-sm" placeholder="Description" value={line.description} onChange={(event) => updateLine(type, index, "description", event.target.value)} /><input type="number" min="0" step="0.01" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" placeholder="Amount" value={line.amount} onChange={(event) => updateLine(type, index, "amount", event.target.value)} /><button type="button" onClick={() => removeLine(type, index)} className="rounded-lg border border-red-200 px-2 py-2 text-xs text-red-700">Remove</button></div>)}{!draft.length ? <div className="text-xs text-slate-500">No {type.toLowerCase()} lines.</div> : null}</div></div>;
                          })}
                          <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Reason for adjustment change (optional)" value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} />
                          <button type="button" disabled={busy === `adjust-${item.id}`} onClick={() => void saveAdjustments(item.id)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60">{busy === `adjust-${item.id}` ? "Saving..." : "Save adjustments"}</button>
                        </div>
                      ) : null}

                      {paymentItemId === item.id ? <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4"><div className="grid gap-3 md:grid-cols-2"><select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="BANK_TRANSFER">Bank transfer</option><option value="CHECK">Check</option><option value="MOBILE_MONEY">Mobile money</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select><input type="datetime-local" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /><input className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Payment reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></div><textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Payment notes" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} /><button type="button" disabled={busy === `pay-${item.id}`} onClick={() => void markPaid(item.id)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60">{busy === `pay-${item.id}` ? "Saving..." : "Confirm payment"}</button></div> : null}

                      {reversalItemId === item.id ? <div className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-sm text-red-800">This preserves the original payment and records a controlled reversal.</p><textarea className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm" placeholder="Required reversal reason" value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} /><button type="button" disabled={busy === `reverse-${item.id}`} onClick={() => void reversePayment(item.id)} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-60">{busy === `reverse-${item.id}` ? "Reversing..." : "Confirm reversal"}</button></div> : null}
                    </article>
                  );
                })}
                {!details.items.length ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No payroll items found.</div> : null}
              </div>
            </section>

            {details.events?.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">Workflow history</h3><div className="mt-3 space-y-2">{details.events.map((event) => <div key={event.id} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{event.fromStatus ? `${event.fromStatus} → ` : ""}{event.toStatus ?? event.eventType}</span><span className="text-xs text-slate-500">{dateTime(event.createdAt)}</span></div>{event.note ? <div className="mt-1 text-slate-600">{event.note}</div> : null}</div>)}</div></section> : null}
          </>
        ) : null}
      </div>

      {register ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 print:rounded-none print:border-0 print:p-0">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payroll payment register</div><h2 className="mt-1 text-2xl font-bold text-slate-900">{register.run.payrollNumber ?? "Payroll run"}</h2><p className="text-sm text-slate-600">{register.run.periodLabel} · {register.run.periodStart ?? "-"} to {register.run.periodEnd ?? "-"}</p></div><div className="flex gap-2 print:hidden"><button type="button" onClick={() => window.print()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Print register</button><button type="button" onClick={() => setRegister(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">Close</button></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Staff</div><div className="text-lg font-bold">{register.summary.staffCount}</div></div><div className="rounded-lg bg-green-50 p-3"><div className="text-xs text-green-700">Paid</div><div className="text-lg font-bold text-green-900">{register.summary.paidCount}</div></div><div className="rounded-lg bg-amber-50 p-3"><div className="text-xs text-amber-700">Pending</div><div className="text-lg font-bold text-amber-900">{register.summary.pendingCount}</div></div><div className="rounded-lg bg-red-50 p-3"><div className="text-xs text-red-700">Reversed</div><div className="text-lg font-bold text-red-900">{register.summary.reversedCount}</div></div></div>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-xs"><thead><tr className="border-b border-slate-300"><th className="p-2">Staff</th><th className="p-2">Gross</th><th className="p-2">Allowances</th><th className="p-2">Deductions</th><th className="p-2">Net</th><th className="p-2">Status</th><th className="p-2">Method / reference</th></tr></thead><tbody>{register.entries.map((entry) => <tr key={entry.payrollItemId} className="border-b border-slate-200"><td className="p-2"><div className="font-medium">{entry.fullName}</div><div className="text-slate-500">{entry.staffCode ?? "-"} · {entry.positionTitle ?? "-"}</div></td><td className="p-2">{money(entry.grossSalary, register.run.currencyCode)}</td><td className="p-2">{money(entry.allowances, register.run.currencyCode)}</td><td className="p-2">{money(entry.deductions, register.run.currencyCode)}</td><td className="p-2 font-semibold">{money(entry.netSalary, register.run.currencyCode)}</td><td className="p-2">{entry.paymentStatus}</td><td className="p-2">{entry.paymentMethod?.replaceAll("_", " ") ?? "-"}<div className="text-slate-500">{entry.paymentReference ?? "-"}</div></td></tr>)}</tbody><tfoot><tr className="border-t-2 border-slate-400 font-bold"><td className="p-2">Totals</td><td className="p-2">{money(register.summary.totalGross, register.run.currencyCode)}</td><td className="p-2">{money(register.summary.totalAllowances, register.run.currencyCode)}</td><td className="p-2">{money(register.summary.totalDeductions, register.run.currencyCode)}</td><td className="p-2">{money(register.summary.totalNet, register.run.currencyCode)}</td><td colSpan={2} /></tr></tfoot></table></div>
          <div className="mt-12 hidden grid-cols-2 gap-16 print:grid"><div className="border-t border-slate-500 pt-2 text-xs">Prepared / processed by</div><div className="border-t border-slate-500 pt-2 text-xs">Approved by</div></div>
        </section>
      ) : null}
    </div>
  );
}