import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initializeAttendanceDraft,
  attendanceFingerprint,
  attendanceCounts,
  markUnmarkedPresent,
  isAttendanceDate,
} from "../lib/attendance-draft.ts";

test("API default present is unmarked until explicitly recorded", () => {
  const draft = initializeAttendanceDraft([
    { id: "new", attendance: { id: null, status: "PRESENT", note: null } },
    {
      id: "saved",
      attendance: { id: "record", status: "ABSENT", note: "Called" },
    },
  ]);
  assert.equal(draft.new.status, "");
  assert.deepEqual(draft.saved, { status: "ABSENT", note: "Called" });
  assert.deepEqual(attendanceCounts(draft), {
    PRESENT: 0,
    ABSENT: 1,
    LATE: 0,
    EXCUSED: 0,
    UNMARKED: 1,
  });
});
test("bulk action preserves explicit statuses, notes and original draft", () => {
  const original = {
    a: { status: "ABSENT", note: "Sick" },
    b: { status: "", note: "Check" },
    c: { status: "LATE", note: "" },
  };
  const next = markUnmarkedPresent(original);
  assert.deepEqual(next.a, original.a);
  assert.deepEqual(next.b, { status: "PRESENT", note: "Check" });
  assert.deepEqual(next.c, original.c);
  assert.equal(original.b.status, "");
});
test("dirty detection includes notes and status but ignores key order", () => {
  const a = {
    a: { status: "PRESENT", note: "" },
    b: { status: "LATE", note: "Bus" },
  };
  assert.equal(
    attendanceFingerprint(a),
    attendanceFingerprint({ b: a.b, a: a.a }),
  );
  assert.notEqual(
    attendanceFingerprint(a),
    attendanceFingerprint({ ...a, a: { ...a.a, note: "Updated" } }),
  );
  assert.notEqual(
    attendanceFingerprint(a),
    attendanceFingerprint({ ...a, a: { ...a.a, status: "ABSENT" } }),
  );
});
test("all four saved statuses reload correctly; unsupported values stay unmarked", () => {
  for (const status of ["PRESENT", "ABSENT", "LATE", "EXCUSED"])
    assert.equal(
      initializeAttendanceDraft([
        { id: "s", attendance: { id: "r", status, note: null } },
      ]).s.status,
      status,
    );
  assert.equal(
    initializeAttendanceDraft([
      { id: "s", attendance: { id: "r", status: "UNKNOWN", note: null } },
    ]).s.status,
    "",
  );
});
test("empty register does not fabricate counts", () => {
  assert.deepEqual(attendanceCounts({}), {
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    EXCUSED: 0,
    UNMARKED: 0,
  });
});
test("invalid date parameters are rejected", () => {
  assert.ok(isAttendanceDate("2024-02-29"));
  for (const date of ["", "2025-02-29", "2026-04-31", "2026-10-07T12:00:00Z"])
    assert.equal(isAttendanceDate(date), false);
});
