"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";

type ReportCard = {
  school: {
    name: string;
    code: string | null;
  };
  student: {
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
    studentStatus: string;
  };
  currentClass: {
    sectionId: string;
    sectionCode: string | null;
    sectionNameI18n: Record<string, string> | null;
    gradeLevelCode: string | null;
    gradeLevelNameI18n: Record<string, string> | null;
  } | null;
  subjects: Array<{
    subjectName: string;
    averagePercent: number | null;
    averageOn20: number | null;
    assessments: Array<{
      assessmentId: string;
      title: string;
      assessmentType: string;
      assessmentDate: string | null;
      maxPoints: number;
      weightPercent: number;
      score: number | null;
      note: string | null;
      percentage: number | null;
    }>;
  }>;
  attendanceTotals: {
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  summary: {
    generalAverageOn20: number | null;
    subjectCount: number;
  };
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
) {
  return value?.fr ?? value?.en ?? fallback;
}

function classLabel(report: ReportCard) {
  if (!report.currentClass) return "No class assigned";

  const grade = i18nName(
    report.currentClass.gradeLevelNameI18n,
    report.currentClass.gradeLevelCode ?? "",
  );
  const section = i18nName(
    report.currentClass.sectionNameI18n,
    report.currentClass.sectionCode ?? "",
  );

  if (section.toLowerCase().includes(grade.toLowerCase())) {
    return section;
  }

  return [grade, section].filter(Boolean).join(" - ");
}

function formatAverage(value: number | null) {
  return value === null ? "-" : value.toFixed(2);
}

function decisionLabel(avg: number | null) {
  if (avg === null) return "Not evaluated";
  if (avg >= 10) return "Passed";
  return "Needs support";
}

function decisionTone(avg: number | null) {
  if (avg === null) return "neutral";
  if (avg >= 10) return "green";
  return "amber";
}

export function StudentReportCardPrintClient({
  schoolId,
  studentId,
}: {
  schoolId: string;
  studentId: string;
}) {
  const [report, setReport] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReport() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });
      const res = await fetch(
        `/api/gradebooks/students/${studentId}/report-card?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load report card.");
      }

      setReport(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load report card.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, studentId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/students/${studentId}`}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Back to Student
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Print / Save as PDF
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 print:hidden">
          Loading report card...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      ) : null}

      {report ? (
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                Report Card
              </div>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                {report.school.name}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {report.school.code ? `${report.school.code} - ` : ""}
                Student Academic Report
              </p>
            </div>

            <SchoolBadge
              tone={decisionTone(report.summary.generalAverageOn20) as any}
            >
              {decisionLabel(report.summary.generalAverageOn20)}
            </SchoolBadge>
          </div>

          <div className="grid gap-6 border-b border-slate-200 py-6 md:grid-cols-2">
            <div>
              <h2 className="font-semibold text-slate-900">Student</h2>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-900">Name:</span>{" "}
                  {report.student.firstName} {report.student.lastName}
                </div>
                <div>
                  <span className="font-medium text-slate-900">Code:</span>{" "}
                  {report.student.studentCode ?? "-"}
                </div>
                <div>
                  <span className="font-medium text-slate-900">Status:</span>{" "}
                  {report.student.studentStatus}
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">Class</h2>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-900">Class:</span>{" "}
                  {classLabel(report)}
                </div>
                <div>
                  <span className="font-medium text-slate-900">
                    General average:
                  </span>{" "}
                  {formatAverage(report.summary.generalAverageOn20)} / 20
                </div>
                <div>
                  <span className="font-medium text-slate-900">Subjects:</span>{" "}
                  {report.summary.subjectCount}
                </div>
              </div>
            </div>
          </div>

          <div className="py-6">
            <h2 className="font-semibold text-slate-900">Academic Results</h2>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border border-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border border-slate-200 px-3 py-2 text-left">
                      Subject
                    </th>
                    <th className="border border-slate-200 px-3 py-2 text-left">
                      Assessments
                    </th>
                    <th className="border border-slate-200 px-3 py-2 text-right">
                      Average / 20
                    </th>
                    <th className="border border-slate-200 px-3 py-2 text-right">
                      %
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {report.subjects.map((subject) => (
                    <tr key={subject.subjectName}>
                      <td className="border border-slate-200 px-3 py-2 font-medium">
                        {subject.subjectName}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        {subject.assessments.map((assessment) => (
                          <div key={assessment.assessmentId}>
                            {assessment.title}:{" "}
                            {assessment.score === null
                              ? "-"
                              : `${assessment.score}/${assessment.maxPoints}`}
                          </div>
                        ))}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right font-semibold">
                        {formatAverage(subject.averageOn20)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right">
                        {subject.averagePercent === null
                          ? "-"
                          : `${subject.averagePercent.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}

                  {report.subjects.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="border border-slate-200 px-3 py-6 text-center text-slate-500"
                      >
                        No gradebook results found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 border-t border-slate-200 py-6 md:grid-cols-2">
            <div>
              <h2 className="font-semibold text-slate-900">Attendance</h2>

              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                <div className="rounded-xl bg-green-50 p-3">
                  <div className="font-bold text-green-900">
                    {report.attendanceTotals.present}
                  </div>
                  <div className="text-xs text-green-700">Pres.</div>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <div className="font-bold text-red-900">
                    {report.attendanceTotals.absent}
                  </div>
                  <div className="text-xs text-red-700">Abs.</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <div className="font-bold text-amber-900">
                    {report.attendanceTotals.late}
                  </div>
                  <div className="text-xs text-amber-700">Late</div>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <div className="font-bold text-blue-900">
                    {report.attendanceTotals.excused}
                  </div>
                  <div className="text-xs text-blue-700">Exc.</div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">Summary</h2>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex justify-between text-sm">
                  <span>General average</span>
                  <span className="font-bold">
                    {formatAverage(report.summary.generalAverageOn20)} / 20
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span>Decision</span>
                  <span className="font-bold">
                    {decisionLabel(report.summary.generalAverageOn20)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
                Teacher
              </div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
                Direction
              </div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
                Parent / Guardian
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
