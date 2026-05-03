"use client";

import { useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type AttendanceOverview = {
  schoolId: string;
  attendanceDate: string;
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
      locked: boolean;
      sessionStatus: "DRAFT" | "SUBMITTED" | "LOCKED" | null;
      attendanceSessionId: string | null;
    };
    afternoon: {
      exists: boolean;
      completed: boolean;
      locked: boolean;
      sessionStatus: "DRAFT" | "SUBMITTED" | "LOCKED" | null;
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

function SlotStatusBadge({
  completed,
  locked,
  sessionStatus,
}: {
  completed: boolean;
  locked: boolean;
  sessionStatus: string | null;
}) {
  if (locked) {
    return <SchoolBadge tone="green">Locked</SchoolBadge>;
  }

  if (sessionStatus === "SUBMITTED") {
    return <SchoolBadge tone="blue">Submitted</SchoolBadge>;
  }

  if (completed) {
    return <SchoolBadge tone="green">Completed</SchoolBadge>;
  }

  if (sessionStatus === "DRAFT") {
    return <SchoolBadge tone="amber">Draft</SchoolBadge>;
  }

  return <SchoolBadge tone="red">Missing</SchoolBadge>;
}

export function AttendanceAdminReviewClient({
  schoolId,
  onLocked,
}: {
  schoolId: string;
  onLocked?: () => void;
}) {
  const [attendanceDate, setAttendanceDate] = useState(todayIsoDate());
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockingId, setLockingId] = useState("");
  const [message, setMessage] = useState("");
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
        throw new Error(body?.message ?? "Failed to load review data.");
      }

      setOverview(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review data.");
    } finally {
      setLoading(false);
    }
  }

  async function lockSession(attendanceSessionId: string) {
    setLockingId(attendanceSessionId);
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        `/api/attendance/sessions/${attendanceSessionId}/lock`,
        { method: "POST" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to lock attendance session.");
      }

      setMessage("Attendance session locked successfully.");
      await loadOverview();
      onLocked?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to lock attendance session.",
      );
    } finally {
      setLockingId("");
    }
  }

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, attendanceDate]);

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Admin Review & Locking
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Review submitted attendance sessions and lock them after validation.
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
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
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

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading review data...
        </div>
      ) : null}

      {overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Completion</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.completionPercent}%
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Completed</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.completedSessions}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Expected</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.expectedSessions}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Missing</div>
              <div className="mt-2 text-3xl font-bold">
                {overview.summary.missingSessions}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Grade / Section</th>
                  <th className="px-4 py-3">Morning</th>
                  <th className="px-4 py-3">Morning Action</th>
                  <th className="px-4 py-3">Afternoon</th>
                  <th className="px-4 py-3">Afternoon Action</th>
                </tr>
              </thead>
              <tbody>
                {overview.sectionBreakdown.map((section) => (
                  <tr key={section.sectionId} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {section.gradeLevelNameI18n?.fr ?? section.gradeLevelCode} -{" "}
                        {section.sectionNameI18n?.fr ?? section.sectionCode}
                      </div>
                      <div className="text-xs text-slate-500">
                        {section.gradeLevelCode} / {section.sectionCode}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <SlotStatusBadge
                        completed={section.morning.completed}
                        locked={section.morning.locked}
                        sessionStatus={section.morning.sessionStatus}
                      />
                    </td>

                    <td className="px-4 py-3">
                      {section.morning.sessionStatus === "SUBMITTED" &&
                      section.morning.attendanceSessionId ? (
                        <button
                          type="button"
                          disabled={lockingId === section.morning.attendanceSessionId}
                          onClick={() =>
                            lockSession(section.morning.attendanceSessionId!)
                          }
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {lockingId === section.morning.attendanceSessionId
                            ? "Locking..."
                            : "Lock"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <SlotStatusBadge
                        completed={section.afternoon.completed}
                        locked={section.afternoon.locked}
                        sessionStatus={section.afternoon.sessionStatus}
                      />
                    </td>

                    <td className="px-4 py-3">
                      {section.afternoon.sessionStatus === "SUBMITTED" &&
                      section.afternoon.attendanceSessionId ? (
                        <button
                          type="button"
                          disabled={lockingId === section.afternoon.attendanceSessionId}
                          onClick={() =>
                            lockSession(section.afternoon.attendanceSessionId!)
                          }
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {lockingId === section.afternoon.attendanceSessionId
                            ? "Locking..."
                            : "Lock"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}

                {overview.sectionBreakdown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No sections found for this school.
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
