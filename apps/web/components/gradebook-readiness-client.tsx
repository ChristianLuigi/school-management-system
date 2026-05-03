"use client";

import { useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type Readiness = {
  gradebookId: string;
  schoolId: string;
  workflowStatus: string;
  isReady: boolean;
  blockingIssues: string[];
  warnings: string[];
  summary: {
    assessments: number;
    activeStudents: number;
    totalWeight: number;
    expectedScoreEntries: number;
    existingScoreEntries: number;
    missingScores: number;
    invalidScores: number;
  };
};

export function GradebookReadinessClient({
  gradebookId,
}: {
  gradebookId: string;
}) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkReadiness() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/gradebooks/${gradebookId}/readiness`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to check readiness.");
      }

      setReadiness(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check readiness.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Readiness Check
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Validate assessments, weights, and score completeness before submission.
          </div>
        </div>

        <button
          type="button"
          onClick={checkReadiness}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Checking..." : "Check"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {readiness ? (
        <div className="mt-4 space-y-4">
          <div>
            {readiness.isReady ? (
              <SchoolBadge tone="green">Ready for submission</SchoolBadge>
            ) : (
              <SchoolBadge tone="red">Not ready</SchoolBadge>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white p-3">
              <div className="text-xs text-slate-500">Assessments</div>
              <div className="mt-1 text-xl font-bold">
                {readiness.summary.assessments}
              </div>
            </div>

            <div className="rounded-xl bg-white p-3">
              <div className="text-xs text-slate-500">Students</div>
              <div className="mt-1 text-xl font-bold">
                {readiness.summary.activeStudents}
              </div>
            </div>

            <div className="rounded-xl bg-white p-3">
              <div className="text-xs text-slate-500">Total Weight</div>
              <div className="mt-1 text-xl font-bold">
                {readiness.summary.totalWeight}%
              </div>
            </div>

            <div className="rounded-xl bg-white p-3">
              <div className="text-xs text-slate-500">Expected Scores</div>
              <div className="mt-1 text-xl font-bold">
                {readiness.summary.expectedScoreEntries}
              </div>
            </div>

            <div className="rounded-xl bg-white p-3">
              <div className="text-xs text-slate-500">Existing Scores</div>
              <div className="mt-1 text-xl font-bold">
                {readiness.summary.existingScoreEntries}
              </div>
            </div>

            <div className="rounded-xl bg-white p-3">
              <div className="text-xs text-slate-500">Missing / Invalid</div>
              <div className="mt-1 text-xl font-bold">
                {readiness.summary.missingScores} /{" "}
                {readiness.summary.invalidScores}
              </div>
            </div>
          </div>

          {readiness.blockingIssues.length > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="text-sm font-semibold text-red-900">
                Blocking Issues
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
                {readiness.blockingIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {readiness.warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-semibold text-amber-900">
                Warnings
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                {readiness.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
