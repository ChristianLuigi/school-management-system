"use client";

import { useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type StudentAttendanceHistory = {
  records: Array<{
    date: string;
    slot: "MORNING" | "AFTERNOON";
    status: AttendanceStatus;
    note: string | null;
    sectionName: string | null;
    submittedAt: string | null;
  }>;
  totals: {
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
};

function statusTone(status: AttendanceStatus): BadgeTone {
  if (status === "PRESENT") return "green";
  if (status === "ABSENT") return "red";
  if (status === "LATE") return "amber";
  return "blue";
}

function slotLabel(slot: "MORNING" | "AFTERNOON") {
  return slot === "MORNING" ? "Morning" : "Afternoon";
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

export function StudentAttendanceHistoryPanelClient({
  schoolId,
  studentId,
}: {
  schoolId: string;
  studentId: string;
}) {
  const [history, setHistory] = useState<StudentAttendanceHistory | null>(null);
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
        throw new Error(
          body?.message ?? "Failed to load attendance history.",
        );
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

  const totals = history?.totals ?? {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Attendance History
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Recent attendance records submitted for this student.
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

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-green-50 p-4">
          <div className="text-sm text-green-700">Present</div>
          <div className="mt-1 text-2xl font-bold text-green-950">
            {totals.present}
          </div>
        </div>
        <div className="rounded-xl bg-red-50 p-4">
          <div className="text-sm text-red-700">Absent</div>
          <div className="mt-1 text-2xl font-bold text-red-950">
            {totals.absent}
          </div>
        </div>
        <div className="rounded-xl bg-amber-50 p-4">
          <div className="text-sm text-amber-700">Late</div>
          <div className="mt-1 text-2xl font-bold text-amber-950">
            {totals.late}
          </div>
        </div>
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="text-sm text-blue-700">Excused</div>
          <div className="mt-1 text-2xl font-bold text-blue-950">
            {totals.excused}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Slot</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {history?.records.map((record) => (
              <tr
                key={`${record.date}-${record.slot}-${record.submittedAt ?? ""}`}
                className="border-t border-slate-200"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {formatDate(record.date)}
                </td>
                <td className="px-4 py-3">{slotLabel(record.slot)}</td>
                <td className="px-4 py-3">
                  <SchoolBadge tone={statusTone(record.status)}>
                    {record.status}
                  </SchoolBadge>
                </td>
                <td className="px-4 py-3">{record.sectionName ?? "-"}</td>
                <td className="px-4 py-3">{record.note ?? "-"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {formatDateTime(record.submittedAt)}
                </td>
              </tr>
            ))}

            {!loading && history?.records.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No attendance records found for this student.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
