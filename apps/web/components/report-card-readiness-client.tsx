"use client";

import { PaginatedCollection } from "@/components/paginated-collection";
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
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Report Card Readiness
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish approved gradebooks before official report cards are generated.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReadiness}
          className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface"
        >
          Refresh
        </button>
      </div>

      {message ? (
        <div className="rounded-xl border border-success/40 bg-success-subtle p-3 text-sm text-success">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
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
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Published</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.publishedCoveragePercent}%
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Expected</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.totalExpected}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Published</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.published}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Approved</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.approved}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Submitted</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.submitted}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Draft</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.draft}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Rejected</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.rejected}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Missing</div>
              <div className="mt-2 text-3xl font-bold">
                {data.summary.missing}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>Published coverage</span>
              <span>{data.summary.publishedCoveragePercent}%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${data.summary.publishedCoveragePercent}%` }}
              />
            </div>
          </div>

          {data.blockingIssues.length > 0 ? (
            <div className="rounded-xl border border-warning/40 bg-warning-subtle p-3">
              <div className="text-sm font-semibold text-warning">
                Blocking Items
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warning">
                {data.blockingIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {isSchoolAdmin && publishableRows.length > 0 ? (
            <div className="rounded-2xl border border-info/40 bg-info-subtle p-4">
              <div className="font-semibold text-info">
                {publishableRows.length} gradebook(s) ready to publish
              </div>
              <p className="mt-1 text-sm text-info">
                Publishing makes approved gradebooks available for official reporting.
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Report Card Impact</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {<PaginatedCollection items={data.rows} rows columns={5}>{(row) => (
                  <tr key={row.sectionSubjectId} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {row.gradeLevelNameI18n?.fr ?? row.gradeLevelCode} -{" "}
                        {row.sectionNameI18n?.fr ?? row.sectionCode}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.gradeLevelCode} / {row.sectionCode}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {row.subjectNameI18n?.fr ??
                          row.subjectNameI18n?.en ??
                          row.subjectCode}
                      </div>
                      <div className="text-xs text-muted-foreground">
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
                          className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
                        >
                          {publishingId === row.gradebookId
                            ? "Publishing..."
                            : "Publish"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                )}</PaginatedCollection>}

                {data.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
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
