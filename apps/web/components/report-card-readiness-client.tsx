"use client";

import { useEffect, useMemo, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type ReportCardReadiness = {
  schoolId: string;
  gradingPeriod: {
    id: string;
    nameI18n: Record<string, string>;
  } | null;
  isReadyForReportCards: boolean;
  isReadyForPublishing: boolean;
  summary: {
    totalExpected: number;
    missing: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    published: number;
    publishable: number;
    blockingCount: number;
    publishedCoveragePercent: number;
    approvedOrPublishedCoveragePercent: number;
  };
  blockingIssues: string[];
  rows: Array<{
    sectionSubjectId: string;
    sectionId: string;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string>;
    sectionCode: string;
    sectionNameI18n: Record<string, string>;
    subjectCode: string;
    subjectNameI18n: Record<string, string>;
    gradebookId: string | null;
    workflowStatus: string;
    blocksReportCards: boolean;
    canPublish: boolean;
  }>;
};

function statusTone(status: string): "green" | "blue" | "amber" | "red" {
  if (status === "PUBLISHED") return "green";
  if (status === "APPROVED") return "blue";
  if (status === "SUBMITTED") return "amber";
  if (status === "REJECTED" || status === "MISSING") return "red";
  return "amber";
}

export function ReportCardReadinessClient({
  schoolId,
  currentRoles,
  refreshKey = 0,
  onChanged,
}: {
  schoolId: string;
  currentRoles: string[];
  refreshKey?: number;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<ReportCardReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishingId, setPublishingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isSchoolAdmin = currentRoles.includes("SCHOOL_ADMIN");

  async function loadReadiness() {
    if (!schoolId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/gradebooks/report-card-readiness?schoolId=${schoolId}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load report card readiness.");
      }

      setData(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load report card readiness.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function publishGradebook(gradebookId: string) {
    setPublishingId(gradebookId);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/gradebooks/${gradebookId}/publish`, {
        method: "POST",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to publish gradebook.");
      }

      setMessage("Gradebook published successfully.");
      await loadReadiness();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish gradebook.");
    } finally {
      setPublishingId("");
    }
  }

  useEffect(() => {
    loadReadiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, refreshKey]);

  const publishableRows = useMemo(() => {
    return data?.rows.filter((row) => row.canPublish && row.gradebookId) ?? [];
  }, [data]);

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Report Card Readiness
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Publish approved gradebooks before official report cards are generated.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReadiness}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading report card readiness...
        </div>
      ) : null}

      {data ? (
        <>
          <div className="flex flex-wrap gap-2">
            {data.isReadyForReportCards ? (
              <SchoolBadge tone="green">Ready for Report Cards</SchoolBadge>
            ) : data.isReadyForPublishing ? (
              <SchoolBadge tone="blue">Ready for Publishing</SchoolBadge>
            ) : (
              <SchoolBadge tone="amber">Not Ready Yet</SchoolBadge>
            )}

            <SchoolBadge>
              {data.gradingPeriod?.nameI18n?.fr ??
                data.gradingPeriod?.nameI18n?.en ??
                "No active period"}
            </SchoolBadge>
          </div>

          <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Published</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.publishedCoveragePercent}%
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Expected</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.totalExpected}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Published</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.published}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Approved</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.approved}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Submitted</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.submitted}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Draft</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.draft}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Rejected</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.rejected}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Missing</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.missing}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>Published coverage</span>
              <span>{data.summary.publishedCoveragePercent}%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{ width: `${data.summary.publishedCoveragePercent}%` }}
              />
            </div>
          </div>

          {data.blockingIssues.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-semibold text-amber-900">
                Blocking Items
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                {data.blockingIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {isSchoolAdmin && publishableRows.length > 0 ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="font-semibold text-blue-900">
                {publishableRows.length} gradebook(s) ready to publish
              </div>
              <p className="mt-1 text-sm text-blue-800">
                Publishing makes approved gradebooks available for official reporting.
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Report Card Impact</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.sectionSubjectId} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {row.gradeLevelNameI18n?.fr ?? row.gradeLevelCode} -{" "}
                        {row.sectionNameI18n?.fr ?? row.sectionCode}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.gradeLevelCode} / {row.sectionCode}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {row.subjectNameI18n?.fr ??
                          row.subjectNameI18n?.en ??
                          row.subjectCode}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.subjectCode}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <SchoolBadge tone={statusTone(row.workflowStatus)}>
                        {row.workflowStatus}
                      </SchoolBadge>
                    </td>

                    <td className="px-4 py-3">
                      {row.blocksReportCards ? (
                        <SchoolBadge tone="amber">Blocks report cards</SchoolBadge>
                      ) : (
                        <SchoolBadge tone="green">Ready</SchoolBadge>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isSchoolAdmin && row.canPublish && row.gradebookId ? (
                        <button
                          type="button"
                          disabled={publishingId === row.gradebookId}
                          onClick={() => publishGradebook(row.gradebookId!)}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {publishingId === row.gradebookId
                            ? "Publishing..."
                            : "Publish"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}

                {data.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No gradebooks found for report card readiness.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
