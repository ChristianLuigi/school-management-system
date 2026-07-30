"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type LocalizedText = Record<string, string>;

type AcademicYear = {
  id: string;
  nameI18n: LocalizedText;
  status: string;
  startDate: string;
  endDate: string;
};

type GradeLevel = {
  id: string;
  code: string;
  nameI18n: LocalizedText;
};

type BillingPlan = {
  id: string;
  planCode: string;
  academicYearId: string;
  academicYearName: LocalizedText;
  gradeLevelId: string | null;
  gradeLevelCode: string | null;
  gradeLevelName: LocalizedText | null;
  nameI18n: LocalizedText;
  descriptionI18n: LocalizedText;
  feeType: "TUITION" | "REGISTRATION" | "TRANSPORT";
  billingFrequency: "MONTHLY" | "TRIMESTER" | "ONE_TIME";
  defaultAmount: number;
  currencyCode: string;
  defaultDueDays: number;
  isActive: boolean;
};

type BillingRunSummary = {
  id: string;
  feePlanId: string;
  planCode: string;
  planName: LocalizedText;
  billingPeriodCode: string;
  issueDate: string;
  dueDate: string;
  invoiceStatus: string;
  currencyCode: string;
  unitAmount: number;
  candidateCount: number;
  generatedCount: number;
  skippedDuplicateCount: number;
  totalGeneratedAmount: number;
  createdAt: string;
  createdByEmail: string;
};

type BillingContext = {
  schoolId: string;
  academicYears: AcademicYear[];
  gradeLevels: GradeLevel[];
  plans: BillingPlan[];
  recentRuns: BillingRunSummary[];
  capabilities: { canManage: boolean };
};

type PreviewStudent = {
  id: string;
  studentCode: string | null;
  firstName: string | null;
  lastName: string | null;
  gradeLevelCode: string;
  sectionCode: string;
  alreadyBilled: boolean;
  existingInvoiceId: string | null;
  existingInvoiceNumber: string | null;
};

type BillingPreview = {
  plan: BillingPlan;
  billingPeriodCode: string;
  issueDate: string;
  dueDate: string;
  invoiceStatus: "DRAFT" | "ISSUED";
  summary: {
    candidateCount: number;
    generatedCount: number;
    skippedDuplicateCount: number;
    totalAmount: number;
    currencyCode: string;
  };
  students: PreviewStudent[];
};

type RunDetail = {
  id: string;
  planCode: string;
  billingPeriodCode: string;
  generatedCount: number;
  skippedDuplicateCount: number;
  totalGeneratedAmount: number;
  currencyCode: string;
  items: Array<{
    studentId: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
    status: "GENERATED" | "SKIPPED_DUPLICATE";
    invoiceId: string | null;
    invoiceNumber: string | null;
    skipReason: string | null;
  }>;
};

function localized(value: LocalizedText | null | undefined) {
  return value?.fr || value?.en || "—";
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

async function responseBody(response: Response) {
  return response.json().catch(() => null);
}

export function FinanceBillingClient({ schoolId }: { schoolId: string }) {
  const [context, setContext] = useState<BillingContext | null>(null);
  const [preview, setPreview] = useState<BillingPreview | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [planCode, setPlanCode] = useState("");
  const [planNameFr, setPlanNameFr] = useState("");
  const [planNameEn, setPlanNameEn] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [feeType, setFeeType] =
    useState<BillingPlan["feeType"]>("TUITION");
  const [frequency, setFrequency] =
    useState<BillingPlan["billingFrequency"]>("MONTHLY");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("HTG");
  const [dueDays, setDueDays] = useState("10");

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [periodCode, setPeriodCode] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceStatus, setInvoiceStatus] =
    useState<"DRAFT" | "ISSUED">("ISSUED");

  const activePlans = useMemo(
    () => context?.plans.filter((plan) => plan.isActive) ?? [],
    [context],
  );

  const selectedPlan = useMemo(
    () => context?.plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [context, selectedPlanId],
  );

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ schoolId });
      const response = await fetch(
        `/api/finance/billing/context?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to load billing.");
      }
      const nextContext = body as BillingContext;
      setContext(nextContext);
      setAcademicYearId(
        (current) =>
          current ||
          nextContext.academicYears.find((year) => year.status === "ACTIVE")
            ?.id ||
          nextContext.academicYears[0]?.id ||
          "",
      );
      setSelectedPlanId(
        (current) =>
          current ||
          nextContext.plans.find((plan) => plan.isActive)?.id ||
          "",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load billing.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAction("create-plan");
    setError("");
    setMessage("");
    try {
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error("Enter a positive plan amount.");
      }
      const response = await fetch("/api/finance/billing/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          academicYearId,
          gradeLevelId: gradeLevelId || undefined,
          planCode,
          nameI18n: {
            fr: planNameFr.trim() || undefined,
            en: planNameEn.trim() || undefined,
          },
          feeType,
          billingFrequency: frequency,
          defaultAmount: numericAmount,
          currencyCode,
          defaultDueDays: Number(dueDays),
        }),
      });
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to create billing plan.");
      }
      setMessage(`Billing plan ${body.planCode} created.`);
      setPlanCode("");
      setPlanNameFr("");
      setPlanNameEn("");
      setAmount("");
      await loadContext();
      setSelectedPlanId(body.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create billing plan.",
      );
    } finally {
      setAction("");
    }
  }

  async function togglePlan(plan: BillingPlan) {
    if (
      plan.isActive &&
      !window.confirm(
        `Archive ${plan.planCode}? Existing invoices and run history will remain unchanged.`,
      )
    ) {
      return;
    }
    setAction(plan.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/finance/billing/plans/${encodeURIComponent(plan.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId, isActive: !plan.isActive }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to update billing plan.");
      }
      setMessage(
        `Billing plan ${plan.planCode} ${plan.isActive ? "archived" : "reactivated"}.`,
      );
      setPreview(null);
      await loadContext();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update billing plan.",
      );
    } finally {
      setAction("");
    }
  }

  function runPayload(studentIds?: string[]) {
    return {
      schoolId,
      feePlanId: selectedPlanId,
      billingPeriodCode: periodCode,
      issueDate: issueDate || undefined,
      dueDate: dueDate || undefined,
      invoiceStatus,
      studentIds,
    };
  }

  async function previewRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAction("preview");
    setError("");
    setMessage("");
    setRunDetail(null);
    try {
      const response = await fetch("/api/finance/billing/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runPayload()),
      });
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to preview billing run.");
      }
      const nextPreview = body as BillingPreview;
      setPreview(nextPreview);
      setSelectedStudents(
        nextPreview.students
          .filter((student) => !student.alreadyBilled)
          .map((student) => student.id),
      );
      setIssueDate(nextPreview.issueDate);
      setDueDate(nextPreview.dueDate);
    } catch (caught) {
      setPreview(null);
      setSelectedStudents([]);
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to preview billing run.",
      );
    } finally {
      setAction("");
    }
  }

  function toggleStudent(studentId: string) {
    setSelectedStudents((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  }

  async function generateRun() {
    if (!preview || selectedStudents.length === 0) return;
    if (
      !window.confirm(
        `Generate ${selectedStudents.length} ${invoiceStatus.toLowerCase()} invoice(s) for ${preview.billingPeriodCode}?`,
      )
    ) {
      return;
    }
    setAction("generate");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/finance/billing/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(runPayload(selectedStudents)),
      });
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to generate billing run.");
      }
      setMessage(
        `Billing completed: ${body.generatedCount} invoice(s) generated and ${body.skippedDuplicateCount} duplicate(s) skipped.`,
      );
      setPreview(null);
      setSelectedStudents([]);
      await loadContext();
      await loadRun(body.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to generate billing run.",
      );
    } finally {
      setAction("");
    }
  }

  async function loadRun(runId: string) {
    setAction(`run-${runId}`);
    setError("");
    try {
      const params = new URLSearchParams({ schoolId });
      const response = await fetch(
        `/api/finance/billing/runs/${encodeURIComponent(runId)}?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to load billing run.");
      }
      setRunDetail(body as RunDetail);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load billing run.",
      );
    } finally {
      setAction("");
    }
  }

  if (loading && !context) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Loading controlled billing…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!context?.capabilities.canManage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You can review billing history, but controlled billing requires the
          FINANCE_BILLING_MANAGE permission.
        </div>
      ) : null}

      {context?.capabilities.canManage ? (
        <form
          onSubmit={createPlan}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="text-lg font-semibold text-slate-950">
            1. Create a billing plan
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Plans define one charge amount, currency, academic scope, and due
            date rule. Generated invoices preserve a snapshot of these values.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">
              <span className="font-medium">Plan code</span>
              <input
                required
                value={planCode}
                onChange={(event) =>
                  setPlanCode(event.target.value.toUpperCase())
                }
                placeholder="TUITION-M01"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Nom français</span>
              <input
                required={!planNameEn.trim()}
                value={planNameFr}
                onChange={(event) => setPlanNameFr(event.target.value)}
                placeholder="Scolarité mensuelle"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">English name</span>
              <input
                required={!planNameFr.trim()}
                value={planNameEn}
                onChange={(event) => setPlanNameEn(event.target.value)}
                placeholder="Monthly tuition"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Academic year</span>
              <select
                required
                value={academicYearId}
                onChange={(event) => setAcademicYearId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">Select year</option>
                {context?.academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {localized(year.nameI18n)} · {year.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Grade scope</span>
              <select
                value={gradeLevelId}
                onChange={(event) => setGradeLevelId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">All active grades</option>
                {context?.gradeLevels.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.code} · {localized(grade.nameI18n)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Fee type</span>
              <select
                value={feeType}
                onChange={(event) =>
                  setFeeType(event.target.value as BillingPlan["feeType"])
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="TUITION">Tuition</option>
                <option value="REGISTRATION">Registration</option>
                <option value="TRANSPORT">Transport</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Frequency</span>
              <select
                value={frequency}
                onChange={(event) =>
                  setFrequency(
                    event.target.value as BillingPlan["billingFrequency"],
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="TRIMESTER">Trimester</option>
                <option value="ONE_TIME">One time</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Amount</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Currency</span>
              <select
                value={currencyCode}
                onChange={(event) => setCurrencyCode(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="HTG">HTG</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Default due days</span>
              <input
                required
                type="number"
                min="0"
                max="365"
                value={dueDays}
                onChange={(event) => setDueDays(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={action === "create-plan"}
            className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {action === "create-plan" ? "Creating…" : "Create plan"}
          </button>
        </form>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">
          Billing plans
        </h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {context?.plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">
                    {plan.planCode} · {localized(plan.nameI18n)}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {localized(plan.academicYearName)} ·{" "}
                    {plan.gradeLevelCode ?? "All grades"}
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {money(plan.defaultAmount, plan.currencyCode)} ·{" "}
                    {plan.billingFrequency} · due in {plan.defaultDueDays} day(s)
                  </div>
                </div>
                <SchoolBadge tone={plan.isActive ? "green" : "neutral"}>
                  {plan.isActive ? "ACTIVE" : "ARCHIVED"}
                </SchoolBadge>
              </div>
              {context.capabilities.canManage ? (
                <button
                  type="button"
                  disabled={action === plan.id}
                  onClick={() => void togglePlan(plan)}
                  className="mt-4 rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {plan.isActive ? "Archive plan" : "Reactivate plan"}
                </button>
              ) : null}
            </div>
          ))}
          {!context?.plans.length ? (
            <div className="text-sm text-slate-500">
              No controlled billing plans yet.
            </div>
          ) : null}
        </div>
      </section>

      {context?.capabilities.canManage ? (
        <form
          onSubmit={previewRun}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="text-lg font-semibold text-slate-950">
            2. Preview a billing run
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Preview is mandatory. Students already charged for the same plan
            and period are identified before generation.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm xl:col-span-2">
              <span className="font-medium">Active plan</span>
              <select
                required
                value={selectedPlanId}
                onChange={(event) => {
                  setSelectedPlanId(event.target.value);
                  setPreview(null);
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">Select plan</option>
                {activePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.planCode} · {localized(plan.nameI18n)} ·{" "}
                    {money(plan.defaultAmount, plan.currencyCode)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Period code</span>
              <input
                required
                value={periodCode}
                onChange={(event) =>
                  setPeriodCode(event.target.value.toUpperCase())
                }
                placeholder={
                  selectedPlan?.billingFrequency === "MONTHLY"
                    ? "2026-09"
                    : "2026-T1"
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Issue date</span>
              <input
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Invoice state</span>
              <select
                value={invoiceStatus}
                onChange={(event) =>
                  setInvoiceStatus(event.target.value as "DRAFT" | "ISSUED")
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="ISSUED">Issue immediately</option>
                <option value="DRAFT">Create drafts</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={action === "preview" || !selectedPlanId}
            className="mt-5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {action === "preview" ? "Preparing preview…" : "Preview students"}
          </button>
        </form>
      ) : null}

      {preview ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-blue-950">
                3. Confirm the billing preview
              </h2>
              <p className="mt-1 text-sm text-blue-800">
                {preview.plan.planCode} · {preview.billingPeriodCode} ·{" "}
                {preview.issueDate} → {preview.dueDate}
              </p>
            </div>
            <div className="text-right text-sm text-blue-950">
              <div>{preview.summary.candidateCount} candidate(s)</div>
              <div>{preview.summary.skippedDuplicateCount} duplicate(s)</div>
              <div className="font-bold">
                {money(
                  selectedStudents.length * preview.plan.defaultAmount,
                  preview.summary.currencyCode,
                )}{" "}
                selected
              </div>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-blue-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-100 text-left text-blue-900">
                <tr>
                  <th className="px-4 py-3">Generate</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.students.map((student) => (
                  <tr key={student.id} className="border-t border-blue-100">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${student.firstName ?? ""} ${student.lastName ?? ""}`}
                        disabled={student.alreadyBilled}
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {student.firstName} {student.lastName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {student.studentCode ?? "Code pending"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {student.gradeLevelCode} · {student.sectionCode}
                    </td>
                    <td className="px-4 py-3">
                      {student.alreadyBilled ? (
                        <Link
                          href={`/finance/invoices/${student.existingInvoiceId}`}
                          className="text-amber-700 underline"
                        >
                          Already billed · {student.existingInvoiceNumber}
                        </Link>
                      ) : (
                        <span className="text-green-700">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => void generateRun()}
            disabled={action === "generate" || selectedStudents.length === 0}
            className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {action === "generate"
              ? "Generating invoices…"
              : `Generate ${selectedStudents.length} invoice(s)`}
          </button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">
          Recent billing runs
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Plan / period</th>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3">Skipped</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {context?.recentRuns.map((run) => (
                <tr key={run.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {run.planCode} · {run.billingPeriodCode}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(run.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-green-700">
                    {run.generatedCount}
                  </td>
                  <td className="px-4 py-3 text-amber-700">
                    {run.skippedDuplicateCount}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {money(run.totalGeneratedAmount, run.currencyCode)}
                  </td>
                  <td className="px-4 py-3">{run.createdByEmail}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void loadRun(run.id)}
                      disabled={action === `run-${run.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                    >
                      View results
                    </button>
                  </td>
                </tr>
              ))}
              {!context?.recentRuns.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No billing runs yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {runDetail ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Run {runDetail.planCode} · {runDetail.billingPeriodCode}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {runDetail.generatedCount} generated ·{" "}
                {runDetail.skippedDuplicateCount} skipped ·{" "}
                {money(
                  runDetail.totalGeneratedAmount,
                  runDetail.currencyCode,
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRunDetail(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            >
              Close
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {runDetail.items.map((item) => (
              <div
                key={item.studentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {item.firstName} {item.lastName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.studentCode ?? "Code pending"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <SchoolBadge
                    tone={item.status === "GENERATED" ? "green" : "amber"}
                  >
                    {item.status}
                  </SchoolBadge>
                  {item.invoiceId ? (
                    <Link
                      href={`/finance/invoices/${item.invoiceId}`}
                      className="text-blue-700 underline"
                    >
                      {item.invoiceNumber ?? "Open invoice"}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
