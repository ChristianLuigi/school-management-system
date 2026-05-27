"use client";

import { useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type AttendanceDashboard = {
  attendanceDate: string;
  totals: {
    sessionsSubmitted: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  bySection: Array<{
    sectionId: string;
    sectionCode: string;
    sectionNameI18n: Record<string, string> | null;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string> | null;
    morningSubmitted: boolean;
    afternoonSubmitted: boolean;
    present: number;
    absent: number;
    late: number;
    excused: number;
  }>;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
) {
  return value?.fr ?? value?.en ?? fallback;
}

function sectionLabel(row: AttendanceDashboard["bySection"][number]) {
  const grade = i18nName(row.gradeLevelNameI18n, row.gradeLevelCode);
  const section = i18nName(row.sectionNameI18n, row.sectionCode);

  if (section.toLowerCase().includes(grade.toLowerCase())) {
    return section;
  }

  return `${grade} - ${section}`;
}

export function AttendanceDashboardOverviewClient({
  schoolId,
  attendanceDate,
}: {
  schoolId: string;
  attendanceDate: string;
}) {
  const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        schoolId,
        attendanceDate,
      });

      const res = await fetch(`/api/attendance/dashboard?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load attendance dashboard.");
      }

      setDashboard(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load attendance dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, attendanceDate]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Attendance Overview
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Daily submission and attendance status summary.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh Overview"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Sessions</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {dashboard.totals.sessionsSubmitted}
              </div>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <div className="text-sm text-green-800">Present</div>
              <div className="mt-1 text-2xl font-bold text-green-950">
                {dashboard.totals.present}
              </div>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <div className="text-sm text-red-800">Absent</div>
              <div className="mt-1 text-2xl font-bold text-red-950">
                {dashboard.totals.absent}
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 p-4">
              <div className="text-sm text-amber-800">Late</div>
              <div className="mt-1 text-2xl font-bold text-amber-950">
                {dashboard.totals.late}
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <div className="text-sm text-blue-800">Excused</div>
              <div className="mt-1 text-2xl font-bold text-blue-950">
                {dashboard.totals.excused}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {dashboard.bySection.map((row) => (
              <div
                key={row.sectionId}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {sectionLabel(row)}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <SchoolBadge
                        tone={row.morningSubmitted ? "green" : "amber"}
                      >
                        Morning {row.morningSubmitted ? "submitted" : "missing"}
                      </SchoolBadge>

                      <SchoolBadge
                        tone={row.afternoonSubmitted ? "green" : "amber"}
                      >
                        Afternoon{" "}
                        {row.afternoonSubmitted ? "submitted" : "missing"}
                      </SchoolBadge>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="font-bold text-green-700">
                        {row.present}
                      </div>
                      <div>Pres.</div>
                    </div>
                    <div>
                      <div className="font-bold text-red-700">
                        {row.absent}
                      </div>
                      <div>Abs.</div>
                    </div>
                    <div>
                      <div className="font-bold text-amber-700">{row.late}</div>
                      <div>Late</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-700">
                        {row.excused}
                      </div>
                      <div>Exc.</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {dashboard.bySection.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                No classes/sections found.
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
