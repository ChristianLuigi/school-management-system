"use client";

import { useState } from "react";
import { SchoolBadge } from "@/components/school-ui";
import { ReportCardAcademicSelectorsClient } from "@/components/report-card-academic-selectors-client";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type BatchRow = {
  id: string;
  schoolId: string;
  gradingPeriodId: string;
  gradingPeriodNameI18n: Record<string, string>;
  sectionId: string | null;
  sectionCode: string | null;
  sectionNameI18n: Record<string, string> | null;
  gradeLevelCode: string | null;
  gradeLevelNameI18n: Record<string, string> | null;
  batchStatus: string;
  generatedAt: string;
  publishedAt: string | null;
  generatedCount: number;
  averageScore: number | null;
};

type BatchDetails = {
  batch: BatchRow & {
    notes: string | null;
  };
  cards: Array<{
    id: string;
    studentId: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
    averageScore: number | null;
    rankInSection: number | null;
    subjectResults: Array<{
      subjectId: string;
      subjectCode: string;
      subjectNameI18n: Record<string, string>;
      coefficient: number;
      average: number;
    }>;
    createdAt: string;
  }>;
};

function batchStatusTone(status: string): BadgeTone {
  if (status === "PUBLISHED") return "green";
  if (status === "GENERATED") return "blue";
  if (status === "ARCHIVED") return "neutral";
  return "amber";
}

export function ReportCardBatchesClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const [gradingPeriodId, setGradingPeriodId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [details, setDetails] = useState<BatchDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishingId, setPublishingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadBatches() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      if (gradingPeriodId.trim()) {
        params.set("gradingPeriodId", gradingPeriodId.trim());
      }

      if (sectionId.trim()) {
        params.set("sectionId", sectionId.trim());
      }

      const res = await fetch(`/api/report-cards/batches?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load report card batches.");
      }

      setRows(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load report card batches.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function openBatch(batchId: string) {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/report-cards/batches/${batchId}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to open batch.");
      }

      setDetails(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open batch.");
    } finally {
      setLoading(false);
    }
  }

  async function publishBatch(batchId: string) {
    setPublishingId(batchId);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/report-cards/batches/${batchId}/publish`, {
        method: "POST",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to publish batch.");
      }

      setMessage("Report card batch published successfully.");
      await loadBatches();

      if (details?.batch.id === batchId) {
        await openBatch(batchId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish batch.");
    } finally {
      setPublishingId("");
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          Report Card Batches
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Review generated report cards and publish validated batches.
        </p>
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

      <ReportCardAcademicSelectorsClient
        schoolId={schoolId}
        gradingPeriodId={gradingPeriodId}
        sectionId={sectionId}
        onGradingPeriodIdChange={(value) => {
          setGradingPeriodId(value);
          setRows([]);
          setDetails(null);
        }}
        onSectionIdChange={(value) => {
          setSectionId(value);
          setRows([]);
          setDetails(null);
        }}
        mode="filter"
      />

      <button
        type="button"
        onClick={loadBatches}
        disabled={loading}
        className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "Loading..." : "Load Batches"}
      </button>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cards</th>
              <th className="px-4 py-3">Average</th>
              <th className="px-4 py-3">Generated</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-200">
                <td className="px-4 py-3">
                  {row.gradingPeriodNameI18n?.fr ??
                    row.gradingPeriodNameI18n?.en ??
                    row.gradingPeriodId}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">
                    {row.gradeLevelNameI18n?.fr ?? row.gradeLevelCode ?? "-"} -{" "}
                    {row.sectionNameI18n?.fr ?? row.sectionCode ?? "-"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {row.sectionCode ?? "-"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <SchoolBadge tone={batchStatusTone(row.batchStatus)}>
                    {row.batchStatus}
                  </SchoolBadge>
                </td>
                <td className="px-4 py-3">{row.generatedCount}</td>
                <td className="px-4 py-3">
                  {row.averageScore === null ? "-" : row.averageScore}
                </td>
                <td className="px-4 py-3">
                  {new Date(row.generatedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openBatch(row.id)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50"
                    >
                      Open
                    </button>
                    <a
                      href={`/reports/batches/${row.id}/print`}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50"
                    >
                      Print Batch
                    </a>
                    {row.batchStatus === "GENERATED" ? (
                      <button
                        type="button"
                        disabled={publishingId === row.id}
                        onClick={() => publishBatch(row.id)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {publishingId === row.id ? "Publishing..." : "Publish"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No report card batches loaded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {details ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-slate-900">
                Batch Details
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                {details.batch.gradingPeriodNameI18n?.fr ??
                  details.batch.gradingPeriodNameI18n?.en ??
                  details.batch.gradingPeriodId}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/reports/batches/${details.batch.id}/print`}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Print Batch
              </a>
              <SchoolBadge tone={batchStatusTone(details.batch.batchStatus)}>
                {details.batch.batchStatus}
              </SchoolBadge>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Average</th>
                  <th className="px-4 py-3">Subjects</th>
                  <th className="px-4 py-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {details.cards.map((card) => (
                  <tr key={card.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">{card.rankInSection ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {card.firstName ?? ""} {card.lastName ?? ""}
                      </div>
                      <div className="text-xs text-slate-500">
                        {card.studentCode ?? card.studentId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {card.averageScore === null ? "-" : card.averageScore}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(card.subjectResults)
                          ? card.subjectResults.slice(0, 5).map((subject) => (
                              <SchoolBadge key={subject.subjectId}>
                                {subject.subjectCode}: {subject.average}
                              </SchoolBadge>
                            ))
                          : null}
                        {Array.isArray(card.subjectResults) &&
                        card.subjectResults.length > 5 ? (
                          <SchoolBadge>
                            +{card.subjectResults.length - 5} more
                          </SchoolBadge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/reports/cards/${card.id}`}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}

                {details.cards.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No report cards found in this batch.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
