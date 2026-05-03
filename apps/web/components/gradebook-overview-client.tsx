"use client";

import { useEffect, useMemo, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type GradebookOverview = {
  schoolId: string;
  gradingPeriod: {
    id: string;
    nameI18n: Record<string, string>;
  } | null;
  summary: {
    totalExpected: number;
    missing: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    published: number;
    coveragePercent: number;
    approvalQueue: number;
  };
  rows: Array<{
    sectionSubjectId: string;
    sectionId: string;
    sectionCode: string;
    sectionNameI18n: Record<string, string>;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string>;
    subjectId: string;
    subjectCode: string;
    subjectNameI18n: Record<string, string>;
    coefficient: number;
    gradebookId: string | null;
    workflowStatus: string;
    submittedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    publishedAt: string | null;
    needsAction: boolean;
  }>;
};

function statusTone(status: string): "green" | "blue" | "red" | "amber" {
  if (status === "APPROVED" || status === "PUBLISHED") return "green";
  if (status === "SUBMITTED") return "blue";
  if (status === "REJECTED" || status === "MISSING") return "red";
  return "amber";
}

export function GradebookOverviewClient({
  schoolId,
  refreshKey = 0,
}: {
  schoolId: string;
  refreshKey?: number;
}) {
  const [overview, setOverview] = useState<GradebookOverview | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview() {
    if (!schoolId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/gradebooks/overview?schoolId=${schoolId}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load gradebook overview.");
      }

      setOverview(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load gradebook overview.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, refreshKey]);

  const filteredRows = useMemo(() => {
    if (!overview) return [];

    return overview.rows.filter((row) => {
      if (statusFilter && row.workflowStatus !== statusFilter) return false;
      if (attentionOnly && !row.needsAction) return false;

      if (search.trim()) {
        const haystack = [
          row.sectionCode,
          row.gradeLevelCode,
          row.subjectCode,
          row.sectionNameI18n?.fr,
          row.sectionNameI18n?.en,
          row.gradeLevelNameI18n?.fr,
          row.gradeLevelNameI18n?.en,
          row.subjectNameI18n?.fr,
          row.subjectNameI18n?.en,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(search.trim().toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [overview, statusFilter, attentionOnly, search]);

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Gradebook Workflow Overview
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Review missing, draft, submitted, approved, and rejected gradebooks.
          </p>
        </div>

        <button
          type="button"
          onClick={loadOverview}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
          Loading gradebook overview...
        </div>
      ) : null}

      {overview ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">Current Grading Period</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {overview.gradingPeriod?.nameI18n?.fr ??
                overview.gradingPeriod?.nameI18n?.en ??
                "No active grading period"}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Coverage</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.coveragePercent}%
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Expected</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.totalExpected}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Missing</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.missing}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Draft</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.draft}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Submitted</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.submitted}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Approved</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.approved}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Rejected</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.rejected}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Approval Queue</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.approvalQueue}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>Approved / Published coverage</span>
              <span>{overview.summary.coveragePercent}%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{ width: `${overview.summary.coveragePercent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="MISSING">Missing</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PUBLISHED">Published</option>
            </select>

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Search section or subject"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={attentionOnly}
                onChange={(e) => setAttentionOnly(e.target.checked)}
              />
              Needs attention only
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Coefficient</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action Needed</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.sectionSubjectId}
                    className="border-t border-slate-200"
                  >
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

                    <td className="px-4 py-3">{row.coefficient}</td>

                    <td className="px-4 py-3">
                      <SchoolBadge tone={statusTone(row.workflowStatus)}>
                        {row.workflowStatus}
                      </SchoolBadge>
                    </td>

                    <td className="px-4 py-3">
                      {row.workflowStatus === "MISSING" ? (
                        <SchoolBadge tone="red">Create gradebook</SchoolBadge>
                      ) : row.workflowStatus === "DRAFT" ? (
                        <SchoolBadge tone="amber">
                          Complete and submit
                        </SchoolBadge>
                      ) : row.workflowStatus === "SUBMITTED" ? (
                        <SchoolBadge tone="blue">
                          Admin approval required
                        </SchoolBadge>
                      ) : row.workflowStatus === "REJECTED" ? (
                        <SchoolBadge tone="red">
                          Teacher correction required
                        </SchoolBadge>
                      ) : (
                        <SchoolBadge tone="green">No action</SchoolBadge>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No gradebooks found for this filter set.
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
