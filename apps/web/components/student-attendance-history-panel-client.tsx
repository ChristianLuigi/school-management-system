"use client";

import { PaginatedCollection } from "@/components/paginated-collection";
import { useEffect, useState } from "react";
import { SchoolBadge, type SchoolBadgeTone } from "@/components/school-ui";

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

function statusTone(status: string): SchoolBadgeTone {
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
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Attendance History
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent attendance records for this student.
          </p>
        </div>

        <button
          type="button"
          onClick={loadHistory}
          disabled={loading}
          className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-surface disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {history ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-success-subtle p-4">
              <div className="text-sm text-success">Present</div>
              <div className="mt-1 text-2xl font-bold text-success">
                {history.totals.present}
              </div>
            </div>

            <div className="rounded-xl bg-danger-subtle p-4">
              <div className="text-sm text-danger">Absent</div>
              <div className="mt-1 text-2xl font-bold text-danger">
                {history.totals.absent}
              </div>
            </div>

            <div className="rounded-xl bg-warning-subtle p-4">
              <div className="text-sm text-warning">Late</div>
              <div className="mt-1 text-2xl font-bold text-warning">
                {history.totals.late}
              </div>
            </div>

            <div className="rounded-xl bg-info-subtle p-4">
              <div className="text-sm text-info">Excused</div>
              <div className="mt-1 text-2xl font-bold text-info">
                {history.totals.excused}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {<PaginatedCollection items={history.records}>{(record, index) => (
              <div
                key={`${record.attendanceDate}-${record.slot}-${index}`}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground">
                      {record.attendanceDate} - {slotLabel(record.slot)}
                    </div>

                    <div className="mt-1 text-sm text-muted-foreground">
                      {i18nName(record.section.nameI18n, record.section.code)}
                    </div>

                    {record.note ? (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Note: {record.note}
                      </div>
                    ) : null}
                  </div>

                  <SchoolBadge tone={statusTone(record.status)}>
                    {statusLabel(record.status)}
                  </SchoolBadge>
                </div>
              </div>
            )}</PaginatedCollection>}

            {history.records.length === 0 ? (
              <div className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
                No attendance records yet.
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
