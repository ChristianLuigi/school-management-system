"use client";

import { useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type AttendanceHistory = {
  totals: {
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  records: Array<{
    attendanceDate: string;
    slot: string;
    status: string;
    note: string | null;
    submittedAt: string | null;
    section: {
      code: string;
      nameI18n: Record<string, string> | null;
    };
    gradeLevel: {
      code: string;
      nameI18n: Record<string, string> | null;
    };
  }>;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PRESENT: "Present",
    ABSENT: "Absent",
    LATE: "Late",
    EXCUSED: "Excused",
  };

  return labels[status] ?? status;
}

function slotLabel(slot: string) {
  return slot === "MORNING" ? "Morning" : "Afternoon";
}

function statusTone(status: string) {
  if (status === "PRESENT") return "green";
  if (status === "ABSENT") return "red";
  if (status === "LATE") return "amber";
  if (status === "EXCUSED") return "blue";
  return "neutral";
}

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
) {
  return value?.fr ?? value?.en ?? fallback;
}

export function StudentAttendanceHistoryPanelClient({
  schoolId,
  studentId,
}: {
  schoolId: string;
  studentId: string;
}) {
  const [history, setHistory] = useState<AttendanceHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/attendance/students/${studentId}/history?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load attendance history.");
      }

      setHistory(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load attendance history.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, studentId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Attendance History
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Recent attendance records for this student.
          </p>
        </div>

        <button
          type="button"
          onClick={loadHistory}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {history ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-green-50 p-4">
              <div className="text-sm text-green-800">Present</div>
              <div className="mt-1 text-2xl font-bold text-green-950">
                {history.totals.present}
              </div>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <div className="text-sm text-red-800">Absent</div>
              <div className="mt-1 text-2xl font-bold text-red-950">
                {history.totals.absent}
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 p-4">
              <div className="text-sm text-amber-800">Late</div>
              <div className="mt-1 text-2xl font-bold text-amber-950">
                {history.totals.late}
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <div className="text-sm text-blue-800">Excused</div>
              <div className="mt-1 text-2xl font-bold text-blue-950">
                {history.totals.excused}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {history.records.map((record, index) => (
              <div
                key={`${record.attendanceDate}-${record.slot}-${index}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {record.attendanceDate} - {slotLabel(record.slot)}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      {i18nName(record.section.nameI18n, record.section.code)}
                    </div>

                    {record.note ? (
                      <div className="mt-2 text-sm text-slate-500">
                        Note: {record.note}
                      </div>
                    ) : null}
                  </div>

                  <SchoolBadge tone={statusTone(record.status) as any}>
                    {statusLabel(record.status)}
                  </SchoolBadge>
                </div>
              </div>
            ))}

            {history.records.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                No attendance records yet.
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
