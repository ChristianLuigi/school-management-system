"use client";

import { useEffect, useMemo, useState } from "react";
import { GradebookReadinessClient } from "@/components/gradebook-readiness-client";
import { SchoolBadge } from "@/components/school-ui";

type GradebookOverview = {
  schoolId: string;
  gradingPeriod: {
    id: string;
    nameI18n: Record<string, string>;
  } | null;
  rows: Array<{
    sectionSubjectId: string;
    sectionCode: string;
    sectionNameI18n: Record<string, string>;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string>;
    subjectCode: string;
    subjectNameI18n: Record<string, string>;
    gradebookId: string | null;
    workflowStatus: string;
    submittedAt: string | null;
    rejectedAt: string | null;
    needsAction: boolean;
  }>;
};

export function GradebookApprovalClient({
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
  const [overview, setOverview] = useState<GradebookOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState("");
  const [rejectingId, setRejectingId] = useState("");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isSchoolAdmin = currentRoles.includes("SCHOOL_ADMIN");
  const isTeacher = currentRoles.includes("TEACHER");

  async function loadOverview() {
    if (!schoolId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/gradebooks/overview?schoolId=${schoolId}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load approval data.");
      }

      setOverview(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approval data.");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    gradebookId: string,
    action: "approve" | "reject" | "submit",
  ) {
    setActingId(gradebookId);
    setMessage("");
    setError("");

    try {
      const options: RequestInit = {
        method: "POST",
      };

      if (action === "reject") {
        const reason = rejectReasons[gradebookId]?.trim();

        if (!reason || reason.length < 3) {
          throw new Error("A rejection reason is required.");
        }

        options.headers = {
          "Content-Type": "application/json",
        };

        options.body = JSON.stringify({ reason });
      }

      const res = await fetch(`/api/gradebooks/${gradebookId}/${action}`, options);
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        if (body?.blockingIssues?.length) {
          throw new Error(body.blockingIssues.join(" "));
        }

        throw new Error(body?.message ?? `Failed to ${action} gradebook.`);
      }

      setMessage(`Gradebook ${action} action completed.`);
      setRejectingId("");
      await loadOverview();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} gradebook.`);
    } finally {
      setActingId("");
    }
  }

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, refreshKey]);

  const adminQueue = useMemo(() => {
    if (!overview) return [];
    return overview.rows.filter(
      (row) => row.gradebookId && row.workflowStatus === "SUBMITTED",
    );
  }, [overview]);

  const rejectedForTeacher = useMemo(() => {
    if (!overview) return [];
    return overview.rows.filter(
      (row) => row.gradebookId && row.workflowStatus === "REJECTED",
    );
  }, [overview]);

  const visibleRows = isSchoolAdmin ? adminQueue : rejectedForTeacher;

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Gradebook Approval Center
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {isSchoolAdmin
              ? "Approve or reject submitted gradebooks."
              : "Review rejected gradebooks and resubmit after corrections."}
          </p>
        </div>

        <button
          type="button"
          onClick={loadOverview}
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
          Loading approval queue...
        </div>
      ) : null}

      {!loading && visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div className="text-lg font-semibold text-slate-900">
            No gradebooks in this queue
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {isSchoolAdmin
              ? "Submitted gradebooks will appear here for approval."
              : "Rejected gradebooks will appear here for correction and resubmission."}
          </p>
        </div>
      ) : null}

      {visibleRows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
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
                    <div className="text-xs text-slate-500">{row.subjectCode}</div>
                  </td>

                  <td className="px-4 py-3">
                    <SchoolBadge
                      tone={row.workflowStatus === "SUBMITTED" ? "blue" : "red"}
                    >
                      {row.workflowStatus}
                    </SchoolBadge>
                  </td>

                  <td className="px-4 py-3">
                    {isSchoolAdmin && row.gradebookId ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={actingId === row.gradebookId}
                            onClick={() => runAction(row.gradebookId!, "approve")}
                            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                          >
                            {actingId === row.gradebookId ? "Working..." : "Approve"}
                          </button>

                          <button
                            type="button"
                            disabled={actingId === row.gradebookId}
                            onClick={() =>
                              setRejectingId(
                                rejectingId === row.gradebookId ? "" : row.gradebookId!,
                              )
                            }
                            className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>

                        {rejectingId === row.gradebookId ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Reason for rejection"
                              value={rejectReasons[row.gradebookId] ?? ""}
                              onChange={(e) =>
                                setRejectReasons((prev) => ({
                                  ...prev,
                                  [row.gradebookId!]: e.target.value,
                                }))
                              }
                            />

                            <button
                              type="button"
                              disabled={actingId === row.gradebookId}
                              onClick={() => runAction(row.gradebookId!, "reject")}
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              Confirm Rejection
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {isTeacher && row.gradebookId ? (
                      <button
                        type="button"
                        disabled={actingId === row.gradebookId}
                        onClick={() => runAction(row.gradebookId!, "submit")}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {actingId === row.gradebookId ? "Submitting..." : "Resubmit"}
                      </button>
                    ) : null}

                    {row.gradebookId ? (
                      <div className="mt-3">
                        <GradebookReadinessClient gradebookId={row.gradebookId} />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
