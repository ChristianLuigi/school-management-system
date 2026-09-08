"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCheck, ClipboardCheck, RefreshCw, Save } from "lucide-react";
import { AttendanceDashboardOverviewClient } from "@/components/attendance-dashboard-overview-client";
import { SectionSelectorClient } from "@/components/section-selector-client";
import { SchoolBadge } from "@/components/school-ui";
import { useI18n } from "@/components/i18n-provider";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type AttendanceStudent = {
  id: string;
  studentCode: string | null;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  studentStatus: string;
  attendance: {
    id: string | null;
    status: string;
    note: string | null;
  };
};

type AttendanceSessionResponse = {
  section: {
    id: string;
    code: string;
    nameI18n: Record<string, string> | null;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string> | null;
  };
  session: {
    id: string;
    attendanceDate: string;
    slot: string;
    attendanceStatus: string | null;
    submittedAt: string | null;
  } | null;
  students: AttendanceStudent[];
};

const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

function statusLabel(
  status: string | undefined,
  translate: (key: string) => string,
) {
  if (!status) return "-";
  const label = translate(`attendance.${status.toLowerCase()}`);
  return label.startsWith("attendance.") ? status : label;
}

function statusTone(status: string | undefined): BadgeTone {
  if (status === "PRESENT") return "green";
  if (status === "ABSENT") return "red";
  if (status === "LATE") return "amber";
  if (status === "EXCUSED") return "blue";
  return "neutral";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceSessionClient({
  schoolId,
  initialSectionId = "",
  initialAttendanceDate,
  initialSlot = "MORNING",
  canManageStructure = false,
}: {
  schoolId: string;
  initialSectionId?: string;
  initialAttendanceDate?: string;
  initialSlot?: "MORNING" | "AFTERNOON";
  canManageStructure?: boolean;
}) {
  const { locale, t } = useI18n();
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [attendanceDate, setAttendanceDate] = useState(
    initialAttendanceDate && /^\d{4}-\d{2}-\d{2}$/.test(initialAttendanceDate)
      ? initialAttendanceDate
      : todayIsoDate(),
  );
  const [slot, setSlot] = useState(initialSlot);
  const [sectionSelectionReady, setSectionSelectionReady] = useState(false);
  const [sessionData, setSessionData] =
    useState<AttendanceSessionResponse | null>(null);
  const [records, setRecords] = useState<
    Record<string, { status: string; note: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  async function loadSession() {
    setMessage("");
    setError("");

    if (!sectionId) {
      setSessionData(null);
      setRecords({});
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        schoolId,
        sectionId,
        attendanceDate,
        slot,
      });

      const res = await fetch(`/api/attendance/session?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? t("attendance.loadFailed"));
      }

      setSessionData(body);

      const nextRecords: Record<string, { status: string; note: string }> = {};

      for (const student of body.students as AttendanceStudent[]) {
        nextRecords[student.id] = {
          status: student.attendance?.status ?? "PRESENT",
          note: student.attendance?.note ?? "",
        };
      }

      setRecords(nextRecords);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("attendance.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitAttendance() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!sectionId) {
        throw new Error(t("attendance.noClassSelected"));
      }

      const payloadRecords = Object.entries(records).map(
        ([studentId, record]) => ({
          studentId,
          status: record.status,
          note: record.note,
        }),
      );

      if (payloadRecords.length === 0) {
        throw new Error(t("attendance.noStudentsInClass"));
      }

      const res = await fetch("/api/attendance/session/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          sectionId,
          attendanceDate,
          slot,
          records: payloadRecords,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? t("attendance.saveFailed"));
      }

      setMessage(t("attendance.attendanceSubmitted"));
      setDashboardRefreshKey((value) => value + 1);
      await loadSession();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("attendance.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  function updateStudentStatus(studentId: string, status: string) {
    setRecords((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] ?? { note: "" }),
        status,
      },
    }));
  }

  function updateStudentNote(studentId: string, note: string) {
    setRecords((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] ?? { status: "PRESENT" }),
        note,
      },
    }));
  }

  function markAll(status: string) {
    if (!sessionData) return;

    const nextRecords: Record<string, { status: string; note: string }> = {};

    for (const student of sessionData.students) {
      nextRecords[student.id] = {
        status,
        note: records[student.id]?.note ?? "",
      };
    }

    setRecords(nextRecords);
  }

  const counts = useMemo(() => {
    const result: Record<string, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };

    Object.values(records).forEach((record) => {
      result[record.status] = (result[record.status] ?? 0) + 1;
    });

    return result;
  }, [records]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (sectionId) params.set("sectionId", sectionId);
    else params.delete("sectionId");
    params.set("date", attendanceDate);
    params.set("slot", slot);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
  }, [attendanceDate, sectionId, slot]);

  useEffect(() => {
    if (!sectionSelectionReady) return;
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, attendanceDate, slot, sectionSelectionReady]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-slate-950">
            {t("attendance.dailyAttendance")}
          </h2>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <SectionSelectorClient
            schoolId={schoolId}
            sectionId={sectionId}
            onSectionIdChange={setSectionId}
            onSectionDetailsChange={() => setSectionSelectionReady(true)}
            label={t("attendance.classSection")}
            allowEmpty
            autoSelectFirst
            disableFullSections={false}
            includePlanned={false}
            emptyActionHref={
              canManageStructure ? "/academic-structure" : "/academics"
            }
            emptyActionLabel={
              canManageStructure
                ? t("attendance.configure")
                : t("attendance.myClasses")
            }
          />

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {t("attendance.date")}
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={attendanceDate}
              onChange={(event) => setAttendanceDate(event.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {t("attendance.slot")}
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={slot}
              onChange={(event) =>
                setSlot(event.target.value as "MORNING" | "AFTERNOON")
              }
            >
              <option value="MORNING">{t("attendance.morning")}</option>
              <option value="AFTERNOON">{t("attendance.afternoon")}</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadSession}
            disabled={loading || !sectionId || !sectionSelectionReady}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading
              ? t("attendance.loadingRoster")
              : t("attendance.refreshRoster")}
          </button>

          {sessionData ? (
            <>
              <button
                type="button"
                onClick={() => markAll("PRESENT")}
                className="inline-flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800 hover:bg-green-100"
              >
                <CheckCheck className="h-4 w-4" />
                {t("attendance.markAllPresent")}
              </button>

              <button
                type="button"
                onClick={submitAttendance}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? t("common.saving") : t("attendance.saveAttendance")}
              </button>
            </>
          ) : null}
        </div>

        {message ? (
          <div role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      {sessionData ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {ATTENDANCE_STATUSES.map((status) => (
              <div
                key={status}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="text-sm text-slate-500">
                  {statusLabel(status, t)}
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {counts[status] ?? 0}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {t("attendance.roster")}
                </h3>

                <p className="mt-1 text-sm text-slate-600">
                  {t("attendance.rosterCount", {
                    count: sessionData.students.length,
                  })}
                  {sessionData.session?.submittedAt
                    ? ` · ${t("attendance.lastSubmitted", {
                        date: new Date(
                          sessionData.session.submittedAt,
                        ).toLocaleString(
                          locale === "fr" ? "fr-HT" : "en-US",
                        ),
                      })}`
                    : ""}
                </p>
              </div>

              {sessionData.session ? (
                <SchoolBadge tone="green">
                  {t("attendance.savedSession")}
                </SchoolBadge>
              ) : (
                <SchoolBadge tone="amber">
                  {t("attendance.newSession")}
                </SchoolBadge>
              )}
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">{t("attendance.student")}</th>
                    <th className="px-3 py-2">{t("common.status")}</th>
                    <th className="px-3 py-2">{t("attendance.note")}</th>
                  </tr>
                </thead>

                <tbody>
                  {sessionData.students.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">
                          {student.lastName} {student.firstName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {student.studentCode ?? "-"}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {ATTENDANCE_STATUSES.map((status) => {
                            const selected =
                              records[student.id]?.status === status;

                            return (
                              <button
                                key={status}
                                type="button"
                                aria-pressed={selected}
                                aria-label={`${student.lastName ?? ""} ${
                                  student.firstName ?? ""
                                }: ${statusLabel(status, t)}`}
                                onClick={() =>
                                  updateStudentStatus(student.id, status)
                                }
                                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                                  selected
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {statusLabel(status, t)}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-2">
                          <SchoolBadge
                            tone={statusTone(records[student.id]?.status)}
                          >
                            {statusLabel(records[student.id]?.status, t)}
                          </SchoolBadge>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <input
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          aria-label={`${t("attendance.note")}: ${
                            student.lastName ?? ""
                          } ${student.firstName ?? ""}`}
                          placeholder={t("attendance.noteOptional")}
                          value={records[student.id]?.note ?? ""}
                          onChange={(event) =>
                            updateStudentNote(student.id, event.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}

                  {sessionData.students.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-6 text-center text-sm text-slate-500"
                      >
                        {t("attendance.noStudentsInClass")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <AttendanceDashboardOverviewClient
        key={dashboardRefreshKey}
        schoolId={schoolId}
        attendanceDate={attendanceDate}
      />
    </div>
  );
}
