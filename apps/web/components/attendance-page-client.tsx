"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type Section = {
  id: string;
  code: string;
  name_i18n: Record<string, string>;
};

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type Slot = "MORNING" | "AFTERNOON";

type RosterStudent = {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
};

type AttendanceSession = {
  id: string;
  section_id: string;
  attendance_date: string;
  slot: Slot;
  status: "DRAFT" | "SUBMITTED";
};

type AttendanceRecord = {
  student_id: string;
  status: AttendanceStatus;
  note_i18n: Record<string, string> | null;
  student_number: string;
  student_first_name: string;
  student_last_name: string;
};

type SubmitResponse = {
  session: AttendanceSession;
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
};

function todayLocalDate() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

type AttendancePageClientProps = {
  userId: string;
  sections: Section[];
};

export function AttendancePageClient({ userId, sections }: AttendancePageClientProps) {
  const [sectionId, setSectionId] = useState<string>(sections[0]?.id ?? "");
  const [attendanceDate, setAttendanceDate] = useState<string>(todayLocalDate());
  const [slot, setSlot] = useState<Slot>("MORNING");

  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const summary = useMemo(() => {
    const values = Object.values(statuses);
    return {
      total: values.length,
      present: values.filter((x) => x === "PRESENT").length,
      absent: values.filter((x) => x === "ABSENT").length,
      late: values.filter((x) => x === "LATE").length,
      excused: values.filter((x) => x === "EXCUSED").length,
    };
  }, [statuses]);

  async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GET failed: ${res.status} ${text}`);
    }

    return res.json();
  }

  async function apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST failed: ${res.status} ${text}`);
    }

    return res.json();
  }

  function initializeStatuses(students: RosterStudent[]) {
    const nextStatuses: Record<string, AttendanceStatus> = {};
    for (const student of students) {
      nextStatuses[student.student_id] = "PRESENT";
    }
    return nextStatuses;
  }

  async function loadAttendanceData() {
    if (!sectionId) {
      setRoster([]);
      setStatuses({});
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const rosterData = await apiGet<RosterStudent[]>(
        `/attendance/roster?sectionId=${sectionId}`,
      );

      setRoster(rosterData);
      setStatuses(initializeStatuses(rosterData));
      setNotes({});
      setSessionId("");

      const sessions = await apiGet<AttendanceSession[]>(
        `/attendance/sessions?sectionId=${sectionId}&date=${attendanceDate}&slot=${slot}`,
      );

      const currentSession = sessions[0];

      if (currentSession?.id) {
        setSessionId(currentSession.id);

        const records = await apiGet<AttendanceRecord[]>(
          `/attendance/records?attendanceSessionId=${currentSession.id}`,
        );

        const recordStatuses: Record<string, AttendanceStatus> = {};
        const recordNotes: Record<string, string> = {};

        for (const student of rosterData) {
          recordStatuses[student.student_id] = "PRESENT";
        }

        for (const record of records) {
          recordStatuses[record.student_id] = record.status;
          recordNotes[record.student_id] =
            record.note_i18n?.fr ?? record.note_i18n?.en ?? "";
        }

        setStatuses(recordStatuses);
        setNotes(recordNotes);
        setMessage("Existing attendance session loaded.");
      } else {
        setMessage("Roster loaded. No existing session found for this date/slot.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAttendanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, attendanceDate, slot]);

  function setStudentStatus(studentId: string, status: AttendanceStatus) {
    setStatuses((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  }

  function setStudentNote(studentId: string, note: string) {
    setNotes((prev) => ({
      ...prev,
      [studentId]: note,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const records = roster.map((student) => ({
        studentId: student.student_id,
        status: statuses[student.student_id] ?? "PRESENT",
        ...(notes[student.student_id]?.trim()
          ? { note: notes[student.student_id].trim() }
          : {}),
      }));

      const result = await apiPost<SubmitResponse>(
        "/attendance/sessions/submit",
        {
          sectionId,
          attendanceDate,
          slot,
          takenByUserId: userId,
          records,
        },
      );

      setSessionId(result.session.id);
      setMessage(
        `Attendance submitted. Present: ${result.summary.present}, Absent: ${result.summary.absent}, Late: ${result.summary.late}, Excused: ${result.summary.excused}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit attendance.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="mt-1 text-slate-600">
            Load a section roster, mark statuses, and submit morning or afternoon attendance.
          </p>
        </div>

        <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Section</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name_i18n.fr ?? section.name_i18n.en ?? section.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Slot</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={slot}
              onChange={(e) => setSlot(e.target.value as Slot)}
            >
              <option value="MORNING">MORNING</option>
              <option value="AFTERNOON">AFTERNOON</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={loadAttendanceData}
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Reload"}
            </button>
          </div>
        </div>

        {sessionId ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Session ID: {sessionId}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Total</div>
            <div className="mt-2 text-2xl font-bold">{summary.total}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Present</div>
            <div className="mt-2 text-2xl font-bold">{summary.present}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Absent</div>
            <div className="mt-2 text-2xl font-bold">{summary.absent}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Late</div>
            <div className="mt-2 text-2xl font-bold">{summary.late}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Excused</div>
            <div className="mt-2 text-2xl font-bold">{summary.excused}</div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
        >
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold">Roster</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Student #</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((student) => (
                  <tr key={student.student_id} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-3">{student.student_number}</td>
                    <td className="px-4 py-3">
                      {student.first_name} {student.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={statuses[student.student_id] ?? "PRESENT"}
                        onChange={(e) =>
                          setStudentStatus(
                            student.student_id,
                            e.target.value as AttendanceStatus,
                          )
                        }
                      >
                        <option value="PRESENT">PRESENT</option>
                        <option value="ABSENT">ABSENT</option>
                        <option value="LATE">LATE</option>
                        <option value="EXCUSED">EXCUSED</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        placeholder="Optional note"
                        value={notes[student.student_id] ?? ""}
                        onChange={(e) =>
                          setStudentNote(student.student_id, e.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))}

                {roster.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No roster data found for this section.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            <button
              type="submit"
              disabled={submitting || roster.length === 0}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Attendance"}
            </button>
          </div>
        </form>
      </div>
  );
}