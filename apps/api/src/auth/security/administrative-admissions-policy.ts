import { ForbiddenException } from '@nestjs/common';

const INTAKE_FIELDS = new Set([
  'schoolId',
  'academicYearId',
  'desiredGradeLevelId',
  'desiredSectionId',
  'firstName',
  'lastName',
  'gender',
  'dateOfBirth',
  'placeOfBirth',
  'previousSchoolName',
  'previousSchoolAddress',
  'parentFullName',
  'parentPhone',
  'parentEmail',
  'parentProfession',
  'parentAddress',
  'emergencyContactName',
  'emergencyContactPhone',
  'photoReceived',
  'birthCertificateReceived',
  'previousSchoolRecordReceived',
  'parentIdDocumentReceived',
  'conductCertificateReceived',
]);

export function assertAdministrativeIntakeFields(
  roles: string[],
  input: object,
) {
  if (roles.includes('SCHOOL_ADMIN')) return;
  if (
    !roles.includes('ADMIN_STAFF') ||
    Object.entries(input).some(
      ([key, value]) => value !== undefined && !INTAKE_FIELDS.has(key),
    )
  ) {
    throw new ForbiddenException(
      'This admission field requires School Administrator access.',
    );
  }
}
