"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  admissionStatusLabel,
  admissionStatusTone,
} from "@/components/admission-status-panel-client";
import { SchoolBadge } from "@/components/school-ui";

type AdmissionsSummary = {
  totalApplications: number;
  openApplications: number;
  pendingDocuments: number;
  pendingPayment: number;
  examScheduled: number;
  admitted: number;
  convertedToStudent: number;
  rejectedOrCancelled: number;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  upcomingExams: Array<{
    id: string;
    admissionApplicationId: string;
    applicationNumber: string;
    firstName: string;
    lastName: string;
    scheduledAt: string | null;
    location: string | null;
    supervisorName: string | null;
  }>;
};

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass =
    tone === "green"
      ? "border-green-200 bg-green-50 text-green-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "red"
          ? "border-red-200 bg-red-50 text-red-900"
          : tone === "blue"
            ? "border-blue-200 bg-blue-50 text-blue-900"
            : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-sm opacity-80">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

export function AdmissionsSummaryClient({ schoolId }: { schoolId: string }) {
  const [summary, setSummary] = useState<AdmissionsSummary | null>(null);
  const [error, setError] = useState("");

  async function loadSummary() {
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(`/api/admissions/summary?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load admissions summary.");
      }

      setSummary(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load admissions summary.",
      );
    }
  }

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        Loading admissions summary...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Total applications" value={summary.totalApplications} />
        <KpiCard
          label="Open applications"
          value={summary.openApplications}
          tone="blue"
        />
        <KpiCard
          label="Pending documents"
          value={summary.pendingDocuments}
          tone="amber"
        />
        <KpiCard
          label="Pending payment"
          value={summary.pendingPayment}
          tone="red"
        />
        <KpiCard
          label="Exams scheduled"
          value={summary.examScheduled}
          tone="blue"
        />
        <KpiCard
          label="Admitted / confirmed"
          value={summary.admitted}
          tone="green"
        />
        <KpiCard
          label="Converted students"
          value={summary.convertedToStudent}
          tone="green"
        />
        <KpiCard
          label="Rejected / cancelled"
          value={summary.rejectedOrCancelled}
          tone="red"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">
            Applications by Status
          </h3>

          <div className="mt-4 space-y-2">
            {summary.byStatus.map((row) => (
              <div
                key={row.status}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
              >
                <SchoolBadge tone={admissionStatusTone(row.status) as any}>
                  {admissionStatusLabel(row.status)}
                </SchoolBadge>

                <span className="font-bold text-slate-900">{row.count}</span>
              </div>
            ))}

            {summary.byStatus.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                No admission applications yet.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">
            Upcoming Admission Exams
          </h3>

          <div className="mt-4 space-y-3">
            {summary.upcomingExams.map((exam) => (
              <div
                key={exam.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/admissions/${exam.admissionApplicationId}`}
                      className="font-medium text-slate-900 underline-offset-4 hover:underline"
                    >
                      {exam.firstName} {exam.lastName}
                    </Link>

                    <div className="mt-1 text-xs text-slate-500">
                      {exam.applicationNumber}
                    </div>
                  </div>

                  <SchoolBadge tone="blue">
                    {exam.scheduledAt
                      ? new Date(exam.scheduledAt).toLocaleString()
                      : "Scheduled"}
                  </SchoolBadge>
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {exam.location ? `Location: ${exam.location}` : "No location"}
                  {exam.supervisorName
                    ? ` - Supervisor: ${exam.supervisorName}`
                    : ""}
                </div>
              </div>
            ))}

            {summary.upcomingExams.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                No upcoming admission exams.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
