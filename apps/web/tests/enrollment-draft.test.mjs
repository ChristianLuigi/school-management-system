import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateStudentIdentity,
  localDateInputValue,
  enrollmentNextSteps,
} from "../lib/students/enrollment-draft.ts";

const valid = {
  firstName: " Marie ",
  lastName: "Jean",
  dateOfBirth: "2012-02-29",
};
test("valid identity and optional birthday", () => {
  assert.deepEqual(validateStudentIdentity(valid, "2026-10-06"), {});
  assert.deepEqual(
    validateStudentIdentity({ ...valid, dateOfBirth: "" }, "2026-10-06"),
    {},
  );
});
test("names: whitespace and length errors identify the field", () => {
  const errors = validateStudentIdentity(
    { ...valid, firstName: "  ", lastName: "a".repeat(121) },
    "2026-10-06",
  );
  assert.equal(errors.firstName, "students.create.requiredNames");
  assert.equal(errors.lastName, "students.create.namesTooLong");
});
test("reject invalid calendar dates and timestamps", () => {
  for (const dateOfBirth of [
    "2011-02-29",
    "2020-04-31",
    "bad",
    "2012-02-29T00:00:00Z",
  ]) {
    assert.equal(
      validateStudentIdentity({ ...valid, dateOfBirth }, "2026-10-06")
        .dateOfBirth,
      "students.create.invalidBirthDate",
    );
  }
});
test("today allowed but future date rejected", () => {
  assert.deepEqual(
    validateStudentIdentity(
      { ...valid, dateOfBirth: "2026-10-06" },
      "2026-10-06",
    ),
    {},
  );
  assert.equal(
    validateStudentIdentity(
      { ...valid, dateOfBirth: "2026-10-07" },
      "2026-10-06",
    ).dateOfBirth,
    "students.create.futureBirthDate",
  );
});
test("date input uses local calendar components", () => {
  assert.equal(localDateInputValue(new Date(2026, 0, 2, 23, 59)), "2026-01-02");
});
test("progress reflects independently saved guardian, placement and documents", () => {
  assert.deepEqual(
    enrollmentNextSteps({
      hasGuardian: false,
      hasPlacement: true,
      documentsReceived: 2,
    }).map((x) => x.done),
    [false, true, false],
  );
  assert.ok(
    enrollmentNextSteps({
      hasGuardian: true,
      hasPlacement: true,
      documentsReceived: 4,
    }).every((x) => x.done),
  );
});
