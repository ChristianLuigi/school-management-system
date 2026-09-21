import { ForbiddenException } from '@nestjs/common';

const OFFICE_STUDENT_FIELDS = new Set([
  'schoolId',
  'firstName',
  'lastName',
  'studentCode',
  'gender',
  'dateOfBirth',
  'placeOfBirth',
  'previousSchoolName',
  'previousSchoolAddress',
]);

/** Explicit allowlist prevents future DTO additions from expanding office privileges. */
export function assertAdministrativeStudentFields(
  roles: string[],
  input: object,
) {
  if (roles.includes('SCHOOL_ADMIN')) return;
  if (
    !roles.includes('ADMIN_STAFF') ||
    Object.entries(input).some(
      ([key, value]) => value !== undefined && !OFFICE_STUDENT_FIELDS.has(key),
    )
  ) {
    throw new ForbiddenException(
      'This student field requires School Administrator access.',
    );
  }
}
