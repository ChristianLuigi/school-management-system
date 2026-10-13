"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  ClipboardCheck,
  RefreshCw,
  Save,
  LockKeyhole,
} from "lucide-react";
import { AttendanceDashboardOverviewClient } from "@/components/attendance-dashboard-overview-client";
import { SectionSelectorClient } from "@/components/section-selector-client";
import {
  EmptySchoolState,
  SchoolBadge,
  SchoolFeedback,
  schoolActionClass,
} from "@/components/school-ui";
import { useI18n } from "@/components/i18n-provider";
import { localDateInputValue } from "@/lib/students/enrollment-draft";
import {
  ATTENDANCE_STATUSES,
  type AttendanceDraft,
  type AttendanceStatus,
  initializeAttendanceDraft,
  attendanceFingerprint,
  attendanceCounts,
  markUnmarkedPresent,
  isAttendanceDate,
} from "@/lib/attendance-draft";

type AttendanceSessionResponse = {
  section: {
    id: string;
    code: string;
    nameI18n: Record<string, string> | null;
  };
  session: {
    id: string;
    attendanceDate: string;
    slot: string;
    attendanceStatus: string | null;
    submittedAt: string | null;
  } | null;
  students: Array<{
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
    attendance: { id: string | null; status: string; note: string | null };
  }>;
};

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
    initialAttendanceDate && isAttendanceDate(initialAttendanceDate)
      ? initialAttendanceDate
      : localDateInputValue(),
  );
  const [slot, setSlot] = useState(initialSlot);
  const [ready, setReady] = useState(false);
  const [sessionData, setSessionData] =
    useState<AttendanceSessionResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [records, setRecords] = useState<AttendanceDraft>({});
  const [baseline, setBaseline] = useState(attendanceFingerprint({}));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const savingRef = useRef(false);
  const contextKey = JSON.stringify([
    schoolId,
    sectionId,
    attendanceDate,
    slot,
  ]);
  const current = loadedKey === contextKey ? sessionData : null;
  const dirty = Boolean(current) && attendanceFingerprint(records) !== baseline;
  const counts = useMemo(() => attendanceCounts(records), [records]);
  const locked = current?.session?.attendanceStatus === "LOCKED";
  const editable = Boolean(current) && !loading && !saving && !locked;
  const canSave =
    editable &&
    current!.students.length > 0 &&
    counts.UNMARKED === 0 &&
    (dirty || current!.session?.attendanceStatus !== "SUBMITTED");
  const statusLabel = (status: string) =>
    t(`attendance.${status.toLowerCase()}`);

  function confirmDiscard() {
    return (
      !savingRef.current &&
      (!dirty || window.confirm(t("attendance.discardChanges")))
    );
  }

  async function loadSession(preserveSuccess = false) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (!preserveSuccess) setMessage("");
    setError("");
    setLoadedKey("");
    setSessionData(null);
    if (!sectionId || !isAttendanceDate(attendanceDate)) {
      setRecords({});
      setBaseline(attendanceFingerprint({}));
      setLoading(false);
      if (sectionId) setError(t("attendance.invalidDate"));
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
      const response = await fetch(`/api/attendance/session?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          typeof body?.message === "string"
            ? body.message
            : t("attendance.loadFailed"),
        );
      if (
        !body ||
        body.section?.id !== sectionId ||
        !Array.isArray(body.students)
      )
        throw new Error(t("attendance.loadFailed"));
      const draft = initializeAttendanceDraft(body.students);
      if (controller.signal.aborted) return;
      setRecords(draft);
      setBaseline(attendanceFingerprint(draft));
      setSessionData(body);
      setLoadedKey(contextKey);
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(
          preserveSuccess
            ? t("attendance.savedRefreshFailed")
            : caught instanceof Error
              ? caught.message
              : t("attendance.loadFailed"),
        );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  async function submitAttendance() {
    if (savingRef.current || !canSave) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/attendance/session/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          sectionId,
          attendanceDate,
          slot,
          records: current!.students.map((student) => ({
            studentId: student.id,
            ...records[student.id],
          })),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          typeof body?.message === "string"
            ? body.message
            : t("attendance.saveFailed"),
        );
      setBaseline(attendanceFingerprint(records));
      setMessage(
        t("attendance.savedCount", {
          count: current!.students.length,
          date: attendanceDate,
          slot: t(`attendance.${slot.toLowerCase()}`),
        }),
      );
      setDashboardRefreshKey((value) => value + 1);
      await loadSession(true);
    } catch (caught) {
      setError(
        (caught instanceof Error
          ? caught.message
          : t("attendance.saveFailed")) +
          " " +
          t("attendance.entriesKept"),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function updateRecord(
    id: string,
    change: { status?: AttendanceStatus; note?: string },
  ) {
    if (!editable) return;
    setMessage("");
    setRecords((previous) => ({
      ...previous,
      [id]: { ...previous[id], ...change },
    }));
  }

  useEffect(() => {
    if (!ready) return;
    void loadSession();
    return () => requestRef.current?.abort();
    // Loading depends on context, not on edits or translated labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, sectionId, attendanceDate, slot, ready]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (sectionId) params.set("sectionId", sectionId);
    else params.delete("sectionId");
    params.set("date", attendanceDate);
    params.set("slot", slot);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?${params}`,
    );
  }, [sectionId, attendanceDate, slot]);

  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const followLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, window.location.href);
      if (
        url.href === window.location.href ||
        (url.pathname === window.location.pathname &&
          url.search === window.location.search &&
          url.hash)
      )
        return;
      if (
        savingRef.current ||
        !window.confirm(t("attendance.discardChanges"))
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
    };
  }, [dirty, saving, t]);

  const sessionLabel = locked
    ? t("attendance.lockedSession")
    : dirty
      ? t("attendance.unsavedChanges")
      : current?.session?.attendanceStatus === "SUBMITTED"
        ? t("attendance.savedSession")
        : t("attendance.newSession");

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-950">
          <ClipboardCheck
            aria-hidden="true"
            className="h-5 w-5 text-blue-700"
          />
          {t("attendance.dailyAttendance")}
        </h2>
        <fieldset disabled={saving} className="mt-4 grid gap-4 md:grid-cols-3">
          <SectionSelectorClient
            schoolId={schoolId}
            sectionId={sectionId}
            onSectionIdChange={(value) => {
              if (value === sectionId || confirmDiscard()) setSectionId(value);
            }}
            onSectionDetailsChange={() => setReady(true)}
            label={t("attendance.classSection")}
            allowEmpty
            autoSelectFirst
            emptyLabel={t("attendance.noClassSelected")}
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
          <label className="block text-sm font-medium text-slate-700">
            {t("attendance.date")}
            <input
              type="date"
              required
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 focus-visible:ring-2 focus-visible:ring-blue-600"
              value={attendanceDate}
              onChange={(event) => {
                if (confirmDiscard()) setAttendanceDate(event.target.value);
              }}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {t("attendance.slot")}
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus-visible:ring-2 focus-visible:ring-blue-600"
              value={slot}
              onChange={(event) => {
                if (confirmDiscard())
                  setSlot(event.target.value as "MORNING" | "AFTERNOON");
              }}
            >
              <option value="MORNING">{t("attendance.morning")}</option>
              <option value="AFTERNOON">{t("attendance.afternoon")}</option>
            </select>
          </label>
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirmDiscard()) void loadSession();
            }}
            disabled={saving || loading || !sectionId || !ready}
            className={schoolActionClass()}
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            {t(
              loading ? "attendance.loadingRoster" : "attendance.refreshRoster",
            )}
          </button>
          {current ? (
            <SchoolBadge
              tone={
                locked
                  ? "neutral"
                  : dirty
                    ? "amber"
                    : current.session?.attendanceStatus === "SUBMITTED"
                      ? "green"
                      : "blue"
              }
            >
              {sessionLabel}
            </SchoolBadge>
          ) : null}
        </div>
      </section>

      {message ? (
        <SchoolFeedback tone="success">{message}</SchoolFeedback>
      ) : null}
      {error ? <SchoolFeedback>{error}</SchoolFeedback> : null}
      {loading ? (
        <p
          role="status"
          className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"
        >
          {t("attendance.loadingRoster")}
        </p>
      ) : null}
      {!sectionId && ready ? (
        <EmptySchoolState
          title={t("attendance.noClassSelected")}
          description={t("attendance.selectContext")}
        />
      ) : null}

      {current && !loading ? (
        <>
          <section
            className="rounded-2xl border border-slate-200 bg-white p-5"
            aria-busy={saving}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {current.section.nameI18n?.[locale] ?? current.section.code} ·{" "}
                  {attendanceDate} · {t(`attendance.${slot.toLowerCase()}`)}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t("attendance.rosterCount", {
                    count: current.students.length,
                  })}
                </p>
              </div>
              <button
                type="button"
                disabled={!editable || counts.UNMARKED === 0}
                className={schoolActionClass()}
                onClick={() => {
                  if (editable) {
                    setMessage("");
                    setRecords(markUnmarkedPresent(records));
                  }
                }}
              >
                <CheckCheck aria-hidden="true" className="h-4 w-4" />
                {t("attendance.markUnmarkedPresent")}
              </button>
            </div>
            {locked ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                {t("attendance.lockedHint")}
              </p>
            ) : null}
            <div
              className="my-4 flex flex-wrap gap-2"
              aria-label={t("attendance.draftSummary")}
            >
              {([...ATTENDANCE_STATUSES, "UNMARKED"] as const).map((status) => (
                <SchoolBadge
                  key={status}
                  tone={status === "UNMARKED" ? "amber" : "neutral"}
                >
                  {statusLabel(status)} · {counts[status]}
                </SchoolBadge>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">{t("attendance.roster")}</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th scope="col" className="p-3">
                      {t("attendance.student")}
                    </th>
                    <th scope="col" className="p-3">
                      {t("common.status")}
                    </th>
                    <th scope="col" className="p-3">
                      {t("attendance.note")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {current.students.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100">
                      <th scope="row" className="p-3 font-medium">
                        <div>
                          {student.lastName} {student.firstName}
                        </div>
                        <div className="text-xs font-normal text-slate-500">
                          {student.studentCode ?? "—"}
                        </div>
                      </th>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {ATTENDANCE_STATUSES.map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={!editable}
                              aria-pressed={
                                records[student.id]?.status === status
                              }
                              aria-label={`${student.lastName ?? ""} ${student.firstName ?? ""}: ${statusLabel(status)}`}
                              onClick={() =>
                                updateRecord(student.id, { status })
                              }
                              className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60 ${records[student.id]?.status === status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                            >
                              {statusLabel(status)}
                            </button>
                          ))}
                        </div>
                        {!records[student.id]?.status ? (
                          <span className="mt-1 block text-xs text-amber-700">
                            {t("attendance.unmarked")}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <input
                          disabled={!editable}
                          maxLength={1000}
                          className="min-h-11 w-full min-w-40 rounded-xl border border-slate-300 px-3 py-2 focus-visible:ring-2 focus-visible:ring-blue-600"
                          aria-label={`${t("attendance.note")}: ${student.lastName ?? ""} ${student.firstName ?? ""}`}
                          placeholder={t("attendance.noteOptional")}
                          value={records[student.id]?.note ?? ""}
                          onChange={(event) =>
                            updateRecord(student.id, {
                              note: event.target.value,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!current.students.length ? (
              <EmptySchoolState
                title={t("attendance.noStudentsInClass")}
                description={t("attendance.checkEnrollment")}
              />
            ) : null}
          </section>
          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <div role="status" className="text-sm text-slate-700">
              {locked
                ? t("attendance.lockedSession")
                : counts.UNMARKED
                  ? t("attendance.remaining", { count: counts.UNMARKED })
                  : dirty
                    ? t("attendance.unsavedChanges")
                    : sessionLabel}
            </div>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void submitAttendance()}
              className={schoolActionClass("primary")}
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              {t(saving ? "common.saving" : "attendance.saveAttendance")}
            </button>
          </div>
        </>
      ) : null}

      {isAttendanceDate(attendanceDate) ? (
        <AttendanceDashboardOverviewClient
          key={dashboardRefreshKey}
          schoolId={schoolId}
          attendanceDate={attendanceDate}
        />
      ) : null}
    </div>
  );
}
