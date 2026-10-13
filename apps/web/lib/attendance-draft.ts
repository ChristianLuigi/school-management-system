export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type AttendanceDraft = Record<
  string,
  { status: AttendanceStatus | ""; note: string }
>;

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return ATTENDANCE_STATUSES.some((status) => status === value);
}

export function initializeAttendanceDraft(
  students: Array<{
    id: string;
    attendance: { id: string | null; status: string; note: string | null };
  }>,
): AttendanceDraft {
  return Object.fromEntries(
    students.map((student) => [
      student.id,
      {
        // The API's default PRESENT value is not a persisted attendance record.
        status:
          student.attendance.id && isAttendanceStatus(student.attendance.status)
            ? student.attendance.status
            : "",
        note: student.attendance.note ?? "",
      },
    ]),
  );
}

export function attendanceFingerprint(records: AttendanceDraft) {
  return JSON.stringify(
    Object.keys(records)
      .sort()
      .map((id) => [id, records[id].status, records[id].note]),
  );
}

export function attendanceCounts(records: AttendanceDraft) {
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, UNMARKED: 0 };
  for (const record of Object.values(records))
    counts[record.status || "UNMARKED"]++;
  return counts;
}

export function markUnmarkedPresent(records: AttendanceDraft): AttendanceDraft {
  return Object.fromEntries(
    Object.entries(records).map(([id, record]) => [
      id,
      { ...record, status: record.status || "PRESENT" },
    ]),
  );
}

export function isAttendanceDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
