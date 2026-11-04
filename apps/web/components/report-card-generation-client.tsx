"use client";

import { useState } from "react";
import { SchoolBadge } from "@/components/school-ui";
import { ReportCardAcademicSelectorsClient } from "@/components/report-card-academic-selectors-client";

type Readiness = {
  schoolId: string;
  gradingPeriodId: string;
  section: {
    section_id: string;
    section_code: string;
    section_name_i18n: Record<string, string>;
    grade_level_code: string;
    grade_level_name_i18n: Record<string, string>;
  };
  totalSubjects: number;
  publishedSubjects: number;
  isReady: boolean;
  blockers: Array<{
    subjectCode: string;
    subjectNameI18n: Record<string, string>;
    status: string;
  }>;
};

export function ReportCardGenerationClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const [gradingPeriodId, setGradingPeriodId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [notes, setNotes] = useState("");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function checkReadiness() {
    setChecking(true);
    setMessage("");
    setError("");

    try {
      const params = new URLSearchParams({
        schoolId,
        gradingPeriodId,
        sectionId,
      });

      const res = await fetch(
        `/api/report-cards/generation-readiness?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to check readiness.");
      }

      setReadiness(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check readiness.");
    } finally {
      setChecking(false);
    }
  }

  async function generateReportCards() {
    setGenerating(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/report-cards/generate/section", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          gradingPeriodId,
          sectionId,
          notes,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        if (body?.blockers?.length) {
          throw new Error(
            `Generation blocked. ${body.blockers.length} subject(s) are not published.`,
          );
        }

        throw new Error(body?.message ?? "Failed to generate report cards.");
      }

      setMessage(
        `Report cards generated successfully. Batch: ${body.batchId}. Count: ${body.generatedCount}.`,
      );
      setReadiness(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate report cards.",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Report Card Generation
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate report cards only after all required gradebooks are published.
        </p>
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

      <div className="space-y-4">
        <ReportCardAcademicSelectorsClient
          schoolId={schoolId}
          gradingPeriodId={gradingPeriodId}
          sectionId={sectionId}
          onGradingPeriodIdChange={(value) => {
            setGradingPeriodId(value);
            setReadiness(null);
          }}
          onSectionIdChange={(value) => {
            setSectionId(value);
            setReadiness(null);
          }}
          mode="required"
        />

        <textarea
          className="w-full rounded-xl border border-input px-3 py-2 text-sm"
          placeholder="Notes optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={checking || !gradingPeriodId || !sectionId}
          onClick={checkReadiness}
          className="rounded-xl border border-input px-4 py-3 text-sm font-medium hover:bg-surface disabled:opacity-60"
        >
          {checking ? "Checking..." : "Check Readiness"}
        </button>

        <button
          type="button"
          disabled={generating || !readiness?.isReady}
          onClick={generateReportCards}
          className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
        >
          {generating ? "Generating..." : "Generate Report Cards"}
        </button>
      </div>

      {readiness ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            {readiness.isReady ? (
              <SchoolBadge tone="green">Ready</SchoolBadge>
            ) : (
              <SchoolBadge tone="red">Blocked</SchoolBadge>
            )}

            <SchoolBadge>
              Published: {readiness.publishedSubjects} /{" "}
              {readiness.totalSubjects}
            </SchoolBadge>
          </div>

          {readiness.blockers.length > 0 ? (
            <div className="mt-4 rounded-xl border border-danger/40 bg-danger-subtle p-3">
              <div className="text-sm font-semibold text-danger">
                Blocking Gradebooks
              </div>

              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-danger">
                {readiness.blockers.map((blocker) => (
                  <li key={blocker.subjectCode}>
                    {blocker.subjectNameI18n?.fr ??
                      blocker.subjectNameI18n?.en ??
                      blocker.subjectCode}{" "}
                    - {blocker.status}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
