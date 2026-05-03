"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";

type SubjectResult = {
  subjectId: string;
  subjectCode: string;
  subjectNameI18n: Record<string, string>;
  coefficient: number;
  average: number;
};

type ReportCardDetails = {
  id: string;
  batchId: string;
  school: {
    id: string;
    name: string;
    code: string;
  };
  gradingPeriod: {
    id: string;
    nameI18n: Record<string, string>;
  };
  section: {
    id: string;
    code: string;
    nameI18n: Record<string, string>;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string>;
  };
  student: {
    id: string;
    code: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  averageScore: number | null;
  rankInSection: number | null;
  conductNote: string | null;
  attendanceSummary: Record<string, unknown>;
  subjectResults: SubjectResult[];
  snapshot: Record<string, unknown>;
  batchStatus: string;
  generatedAt: string;
  publishedAt: string | null;
};

function formatScore(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toFixed(2);
}

function decisionFromAverage(value: number | null) {
  if (value === null) return "A determiner";
  if (value >= 10) return "Admis";
  return "A surveiller";
}

export function ReportCardViewClient({
  reportCardId,
}: {
  reportCardId: string;
}) {
  const [data, setData] = useState<ReportCardDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReportCard() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/report-cards/cards/${reportCardId}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load report card.");
      }

      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report card.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReportCard();
  }, [reportCardId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/reports"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back to Reports
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Print
          </button>
        </div>

        <button
          type="button"
          onClick={loadReportCard}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 print:hidden">
          Loading report card...
        </div>
      ) : null}

      {data ? (
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <div className="border-b border-slate-200 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                  Bulletin scolaire
                </div>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                  {data.school.name}
                </h1>
                <div className="mt-1 text-sm text-slate-500">
                  Code ecole: {data.school.code}
                </div>
              </div>

              <div className="text-right">
                <SchoolBadge
                  tone={data.batchStatus === "PUBLISHED" ? "green" : "blue"}
                >
                  {data.batchStatus}
                </SchoolBadge>
                <div className="mt-3 text-sm text-slate-500">
                  Genere le {new Date(data.generatedAt).toLocaleDateString()}
                </div>
                {data.publishedAt ? (
                  <div className="text-sm text-slate-500">
                    Publie le {new Date(data.publishedAt).toLocaleDateString()}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-b border-slate-200 py-6 md:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Eleve
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.student.firstName ?? ""} {data.student.lastName ?? ""}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Code: {data.student.code ?? data.student.id}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Classe
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.section.gradeLevelNameI18n?.fr ??
                  data.section.gradeLevelCode}{" "}
                - {data.section.nameI18n?.fr ?? data.section.code}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {data.section.gradeLevelCode} / {data.section.code}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Periode
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.gradingPeriod.nameI18n?.fr ??
                  data.gradingPeriod.nameI18n?.en ??
                  data.gradingPeriod.id}
              </div>
            </div>
          </div>

          <div className="grid gap-4 py-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm text-slate-500">Moyenne generale</div>
              <div className="mt-2 text-4xl font-bold text-slate-900">
                {formatScore(data.averageScore)}
              </div>
              <div className="mt-1 text-xs text-slate-500">sur 20</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm text-slate-500">Rang</div>
              <div className="mt-2 text-4xl font-bold text-slate-900">
                {data.rankInSection ?? "-"}
              </div>
              <div className="mt-1 text-xs text-slate-500">dans la section</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm text-slate-500">Decision</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">
                {decisionFromAverage(data.averageScore)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Matiere</th>
                  <th className="px-4 py-3">Coefficient</th>
                  <th className="px-4 py-3">Moyenne</th>
                  <th className="px-4 py-3">Appreciation</th>
                </tr>
              </thead>
              <tbody>
                {data.subjectResults.map((subject) => (
                  <tr key={subject.subjectId} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {subject.subjectNameI18n?.fr ??
                          subject.subjectNameI18n?.en ??
                          subject.subjectCode}
                      </div>
                      <div className="text-xs text-slate-500">
                        {subject.subjectCode}
                      </div>
                    </td>
                    <td className="px-4 py-3">{subject.coefficient}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatScore(subject.average)}
                    </td>
                    <td className="px-4 py-3">
                      {subject.average >= 16
                        ? "Tres bien"
                        : subject.average >= 14
                          ? "Bien"
                          : subject.average >= 10
                            ? "Passable"
                            : "Insuffisant"}
                    </td>
                  </tr>
                ))}

                {data.subjectResults.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Aucun resultat de matiere trouve.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 py-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="text-sm font-semibold text-slate-900">
                Assiduite
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Resume d'assiduite a integrer dans une prochaine version.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="text-sm font-semibold text-slate-900">
                Conduite / Appreciation generale
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {data.conductNote ?? "Aucune appreciation saisie pour le moment."}
              </p>
            </div>
          </div>

          <div className="grid gap-6 border-t border-slate-200 pt-8 md:grid-cols-3">
            <div className="h-24 border-t border-slate-300 pt-2 text-center text-sm text-slate-500">
              Enseignant
            </div>
            <div className="h-24 border-t border-slate-300 pt-2 text-center text-sm text-slate-500">
              Direction
            </div>
            <div className="h-24 border-t border-slate-300 pt-2 text-center text-sm text-slate-500">
              Parent / Responsable
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
