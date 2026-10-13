export type IdentityDraft = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

/** Local calendar date: UTC rollover must not allow tomorrow's birthday. */
export function localDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validateStudentIdentity(draft: IdentityDraft, today: string) {
  const errors: Partial<Record<keyof IdentityDraft, string>> = {};
  for (const field of ["firstName", "lastName"] as const) {
    if (!draft[field].trim()) errors[field] = "students.create.requiredNames";
    else if (draft[field].trim().length > 120)
      errors[field] = "students.create.namesTooLong";
  }
  if (draft.dateOfBirth) {
    const parsed = new Date(`${draft.dateOfBirth}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(draft.dateOfBirth) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== draft.dateOfBirth
    )
      errors.dateOfBirth = "students.create.invalidBirthDate";
    else if (draft.dateOfBirth > today)
      errors.dateOfBirth = "students.create.futureBirthDate";
  }
  return errors;
}

/** Progress guidance only; these are not new enrollment requirements. */
export function enrollmentNextSteps(input: {
  hasGuardian: boolean;
  hasPlacement: boolean;
  documentsReceived: number;
}) {
  return [
    {
      tab: "guardians" as const,
      label: "students.guardians",
      done: input.hasGuardian,
    },
    {
      tab: "enrollment" as const,
      label: "students.create.placementStep",
      done: input.hasPlacement,
    },
    {
      tab: "documents" as const,
      label: "students.documents",
      done: input.documentsReceived === 4,
    },
  ];
}
