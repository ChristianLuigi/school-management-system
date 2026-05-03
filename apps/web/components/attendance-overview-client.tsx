"use client";

import { useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type AttendanceOverview = {
  schoolId: string;
  attendanceDate: string;
  totals: {
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  summary: {
    sections: number;
    expectedSessions: number;
    completedSessions: number;
    missingSessions: number;
    completionPercent: number;
  };
  sectionBreakdown: Array<{
    sectionId: string;
    sectionCode: string;
    sectionNameI18n: Record<string, string>;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string>;
    morning: {
      exists: boolean;
      completed: boolean;
      attendanceSessionId: string | null;
    };
    afternoon: {
      exists: boolean;
      completed: boolean;
      attendanceSessionId: string | null;
    };
    completedSlots: number;
    missingSlots: number;
    isComplete: boolean;
  }>;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceOverviewClient({
  schoolId,
  refreshKey = 0,
}: {
  schoolId: string;
  refreshKey?: number;
}) {
  const [attendanceDate, setAttendanceDate] = useState(todayIsoDate());
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview() {
    if (!schoolId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/attendance/overview?schoolId=${schoolId}&attendanceDate=${attendanceDate}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load attendance overview.");
      }

      setOverview(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load attendance overview.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, attendanceDate, refreshKey]);

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Daily Attendance Overview
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Review completion and attendance status for the selected day.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
          />

          <button
            type="button"
            onClick={loadOverview}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
          Loading attendance overview...
        </div>
      ) : null}

      {overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Completion</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.completionPercent}%
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {overview.summary.completedSessions} /{" "}
                {overview.summary.expectedSessions} sessions
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Present</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.totals.present}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Absent</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.totals.absent}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Late / Excused</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.totals.late + overview.totals.excused}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Late: {overview.totals.late} / Excused:{" "}
                {overview.totals.excused}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>Daily completion</span>
              <span>{overview.summary.completionPercent}%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{
                  width: `${overview.summary.completionPercent}%`,
                }}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Grade / Section</th>
                  <th className="px-4 py-3">Morning</th>
                  <th className="px-4 py-3">Afternoon</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.sectionBreakdown.map((section) => (
                  <tr
                    key={section.sectionId}
                    className="border-t border-slate-200"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {section.gradeLevelNameI18n?.fr ??
                          section.gradeLevelCode}{" "}
                        - {section.sectionNameI18n?.fr ?? section.sectionCode}
                      </div>
                      <div className="text-xs text-slate-500">
                        {section.gradeLevelCode} / {section.sectionCode}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {section.morning.completed ? (
                        <SchoolBadge tone="green">Completed</SchoolBadge>
                      ) : section.morning.exists ? (
                        <SchoolBadge tone="amber">Started</SchoolBadge>
                      ) : (
                        <SchoolBadge tone="red">Missing</SchoolBadge>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {section.afternoon.completed ? (
                        <SchoolBadge tone="green">Completed</SchoolBadge>
                      ) : section.afternoon.exists ? (
                        <SchoolBadge tone="amber">Started</SchoolBadge>
                      ) : (
                        <SchoolBadge tone="red">Missing</SchoolBadge>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {section.isComplete ? (
                        <SchoolBadge tone="green">Complete</SchoolBadge>
                      ) : (
                        <SchoolBadge tone="amber">
                          {section.missingSlots} missing
                        </SchoolBadge>
                      )}
                    </td>
                  </tr>
                ))}

                {overview.sectionBreakdown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No active sections found for this school.
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

