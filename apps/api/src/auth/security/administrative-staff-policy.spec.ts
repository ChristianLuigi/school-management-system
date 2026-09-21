import { ForbiddenException } from '@nestjs/common';
import { assertAdministrativeStudentFields } from './administrative-staff-policy';
import { assertAdministrativeIntakeFields } from './administrative-admissions-policy';

describe('administrative staff field boundaries', () => {
  it('allows student identity and admission intake fields', () => {
    expect(() =>
      assertAdministrativeStudentFields(['ADMIN_STAFF'], {
        schoolId: 'school',
        firstName: 'Anne',
      }),
    ).not.toThrow();
    expect(() =>
      assertAdministrativeIntakeFields(['ADMIN_STAFF'], {
        schoolId: 'school',
        parentPhone: '123',
        desiredSectionId: 'section',
      }),
    ).not.toThrow();
  });
  it.each([
    'medicalNotes',
    'allergies',
    'specialNeeds',
    'vaccinationStatus',
    'sectionId',
    'clearSection',
    'futureSensitiveField',
  ])('rejects student field %s, including explicit nulls', (field) => {
    expect(() =>
      assertAdministrativeStudentFields(['ADMIN_STAFF'], { [field]: null }),
    ).toThrow(ForbiddenException);
  });
  it.each([
    'admissionStatus',
    'registrationFeeAmount',
    'registrationFeeStatus',
    'notes',
    'vaccinationCardReceived',
    'examStatus',
  ])('rejects admission field %s', (field) => {
    expect(() =>
      assertAdministrativeIntakeFields(['ADMIN_STAFF'], {
        [field]: 'unauthorized',
      }),
    ).toThrow(ForbiddenException);
  });
  it('does not give unrelated roles administrative write access', () => {
    expect(() =>
      assertAdministrativeStudentFields(['TEACHER'], { firstName: 'Anne' }),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertAdministrativeIntakeFields(['FINANCE_ADMIN'], {}),
    ).toThrow(ForbiddenException);
  });
  it('preserves the full School Admin workflow', () => {
    expect(() =>
      assertAdministrativeStudentFields(['SCHOOL_ADMIN'], {
        medicalNotes: 'authorized',
      }),
    ).not.toThrow();
    expect(() =>
      assertAdministrativeIntakeFields(['SCHOOL_ADMIN'], {
        admissionStatus: 'ADMITTED',
      }),
    ).not.toThrow();
  });
});
