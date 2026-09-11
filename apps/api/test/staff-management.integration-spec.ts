import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Pool } from 'pg';
import { UpdateStaffDto } from '../src/staff-management/dto/update-staff.dto';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('staff employment lifecycle and management integration', () => {
  let pool: Pool;
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let factory: IntegrationFactory;

  beforeAll(async () => {
    pool = createIntegrationPool();
    harness = await createServiceHarness();
    factory = new IntegrationFactory(
      pool,
      harness.passwords,
      harness.sessionTokens,
    );
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(pool);
  });

  afterAll(async () => {
    await harness.close();
    await pool.end();
  });

  async function administrator(schoolId: string) {
    const user = await factory.user();
    await factory.membership(schoolId, user.id, 'SCHOOL_ADMIN');
    const staffId = await factory.schoolStaffAccount(schoolId, user.id, {
      staffType: 'SCHOOL_ADMIN',
      jobTitle: 'School Administrator',
      department: 'Administration',
    });
    return { ...user, staffId };
  }

  it('creates offline staff, lists safe summaries, and enforces optimistic updates', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);

    const created = await harness.staffManagement.createStaff(
      {
        schoolId,
        firstName: '  Marie ',
        lastName: ' Laurent  ',
        email: ' MARIE.LAURENT@EXAMPLE.TEST ',
        staffCategory: 'ADMINISTRATIVE',
        employmentType: 'FULL_TIME',
        employmentStatus: 'DRAFT',
        jobTitle: 'Registrar',
        department: 'Registry',
        addressLine1: '12 Rue des Écoles',
        addressCity: 'Pétion-Ville',
        addressRegion: 'Ouest',
        addressCountryCode: 'ht',
        reason: 'Preparing the staff file.',
      },
      admin.id,
    );

    expect(created).toMatchObject({
      userId: null,
      firstName: 'Marie',
      lastName: 'Laurent',
      email: 'MARIE.LAURENT@EXAMPLE.TEST',
      staffCategory: 'ADMINISTRATIVE',
      employmentStatus: 'DRAFT',
      addressLine1: '12 Rue des Écoles',
      addressCity: 'Pétion-Ville',
      addressCountryCode: 'HT',
      rowVersion: 1,
    });
    expect(created.staffCode).toMatch(/^STF-\d{6}$/);

    const transformedContactUpdate = plainToInstance(UpdateStaffDto, {
      schoolId,
      rowVersion: created.rowVersion,
      phone: '+509 3700 0000',
    });
    expect(
      Object.prototype.hasOwnProperty.call(
        transformedContactUpdate,
        'jobTitle',
      ),
    ).toBe(true);
    const contactUpdated = await harness.staffManagement.updateStaff(
      created.id,
      transformedContactUpdate,
      admin.id,
    );
    expect(contactUpdated.phone).toBe('+509 3700 0000');

    const listed = await harness.staffManagement.listStaff(
      {
        schoolId,
        search: 'laurent',
        accountLink: 'UNLINKED',
        page: 1,
        pageSize: 10,
      },
      admin.id,
    );
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).not.toHaveProperty('passwordHash');
    expect(listed.items[0]).not.toHaveProperty('authenticationVersion');
    const beyondLastPage = await harness.staffManagement.listStaff(
      {
        schoolId,
        search: 'laurent',
        page: 2,
        pageSize: 1,
      },
      admin.id,
    );
    expect(beyondLastPage).toMatchObject({
      items: [],
      pagination: {
        page: 2,
        pageSize: 1,
        total: 1,
        pageCount: 1,
      },
    });

    const updated = await harness.staffManagement.updateStaff(
      created.id,
      {
        schoolId,
        rowVersion: contactUpdated.rowVersion,
        jobTitle: 'Senior Registrar',
        department: 'Academic Registry',
        effectiveDate: new Date().toISOString().slice(0, 10),
        changeReason: 'Promotion approved by school administration.',
      },
      admin.id,
    );
    expect(updated).toMatchObject({
      jobTitle: 'Senior Registrar',
      department: 'Academic Registry',
      rowVersion: 3,
    });

    await expect(
      harness.staffManagement.updateStaff(
        created.id,
        {
          schoolId,
          rowVersion: created.rowVersion,
          phone: '+509 3700 0000',
        },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const history = await harness.staffManagement.getHistory(
      created.id,
      schoolId,
      admin.id,
    );
    expect(history.statusEvents).toHaveLength(1);
    expect(history.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          position_title: 'Senior Registrar',
          change_reason: 'Promotion approved by school administration.',
        }),
      ]),
    );
    const medical = await harness.staffManagement.updateStaffMedical(
      created.id,
      {
        schoolId,
        rowVersion: 0,
        emergencyContactName: 'Jean Laurent',
        emergencyContactRelationship: 'Brother',
        emergencyContactPhone: '+509 3700 1111',
        allergiesOrConditions: 'Peanut allergy',
        accommodationNotes: 'Keep emergency medication accessible.',
      },
      admin.id,
    );
    expect(medical).toMatchObject({
      emergencyContactName: 'Jean Laurent',
      allergiesOrConditions: 'Peanut allergy',
      rowVersion: 1,
    });
    const medicalRead = await harness.staffManagement.getStaffMedical(
      created.id,
      schoolId,
      admin.id,
    );
    expect(medicalRead).toMatchObject({
      emergencyContactPhone: '+509 3700 1111',
      accommodationNotes: 'Keep emergency medication accessible.',
      rowVersion: 1,
    });
    const directoryAfterMedical = await harness.staffManagement.listStaff(
      { schoolId, page: 1, pageSize: 10 },
      admin.id,
    );
    expect(JSON.stringify(directoryAfterMedical)).not.toContain(
      'Peanut allergy',
    );
  });

  it('suspends linked staff, revokes sessions, and disables operational access', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const teacher = await factory.user();
    await factory.membership(schoolId, teacher.id, 'TEACHER');
    await factory.membership(schoolId, teacher.id, 'PARENT');
    const teacherStaffId = await factory.schoolStaffAccount(
      schoolId,
      teacher.id,
      {
        staffType: 'TEACHER',
        jobTitle: 'Mathematics Teacher',
        department: 'Academics',
        createdByUserId: admin.id,
      },
    );
    const session = await factory.session(teacher.id);
    const scope = await factory.academicScope(schoolId);
    await factory.teacherAssignment(schoolId, teacher.id, scope, admin.id);
    await pool.query(
      `
      INSERT INTO payroll_staff_profiles (
        school_id,
        school_staff_account_id,
        full_name,
        base_salary,
        currency_code,
        payroll_active
      )
      VALUES ($1, $2, 'Teacher Employee', 50000, 'HTG', TRUE)
      `,
      [schoolId, teacherStaffId],
    );

    const details = await harness.staffManagement.getStaff(
      teacherStaffId,
      schoolId,
      admin.id,
    );
    const result = await harness.staffManagement.suspend(
      teacherStaffId,
      {
        schoolId,
        rowVersion: details.rowVersion,
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Access suspended during an employment review.',
      },
      admin.id,
    );

    expect(result).toMatchObject({
      updated: true,
      staff: { employmentStatus: 'SUSPENDED' },
      effects: {
        sessionsRevoked: 1,
        payrollProfilesDisabled: 1,
        assignmentsChanged: 1,
      },
    });
    const operationalState = await pool.query<{
      payroll_active: boolean;
      assignment_status: string;
      revoked_at: string;
    }>(
      `
      SELECT
        profile.payroll_active,
        assignment.assignment_status,
        session.revoked_at
      FROM payroll_staff_profiles profile
      JOIN teacher_academic_assignments assignment
        ON assignment.teacher_user_id = $2
       AND assignment.school_id = profile.school_id
      JOIN auth_sessions session
        ON session.id = $3
      WHERE profile.school_staff_account_id = $1
      `,
      [teacherStaffId, teacher.id, session.id],
    );
    expect(operationalState.rows[0]).toMatchObject({
      payroll_active: false,
      assignment_status: 'SUSPENDED',
    });
    expect(operationalState.rows[0].revoked_at).toBeTruthy();

    const replacementSession = await factory.session(teacher.id);
    const context = await harness.auth.requireSession(
      `Bearer ${replacementSession.rawToken}`,
    );
    expect(context.school_roles).toEqual([{ schoolId, roleCode: 'PARENT' }]);

    const afterSuspend = await harness.staffManagement.getStaff(
      teacherStaffId,
      schoolId,
      admin.id,
    );
    const reactivated = await harness.staffManagement.reactivate(
      teacherStaffId,
      {
        schoolId,
        rowVersion: afterSuspend.rowVersion,
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Employment review completed.',
      },
      admin.id,
    );
    expect(reactivated.effects.accessReviewRequired).toBe(true);

    const unchanged = await pool.query<{
      payroll_active: boolean;
      assignment_status: string;
    }>(
      `
      SELECT profile.payroll_active, assignment.assignment_status
      FROM payroll_staff_profiles profile
      JOIN teacher_academic_assignments assignment
        ON assignment.teacher_user_id = $2
       AND assignment.school_id = profile.school_id
      WHERE profile.school_staff_account_id = $1
      `,
      [teacherStaffId, teacher.id],
    );
    expect(unchanged.rows[0]).toEqual({
      payroll_active: false,
      assignment_status: 'SUSPENDED',
    });
  });

  it('records termination and rehire periods without restoring privileged access', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const employee = await factory.user();
    await factory.membership(schoolId, employee.id, 'FINANCE_ADMIN');
    const staffId = await factory.schoolStaffAccount(schoolId, employee.id, {
      staffType: 'FINANCE_ADMIN',
      jobTitle: 'Cashier',
      department: 'Finance',
      createdByUserId: admin.id,
    });
    const initial = await harness.staffManagement.getStaff(
      staffId,
      schoolId,
      admin.id,
    );
    const date = new Date().toISOString().slice(0, 10);
    await harness.staffManagement.terminate(
      staffId,
      {
        schoolId,
        rowVersion: initial.rowVersion,
        effectiveDate: date,
        reason: 'Employment contract completed.',
      },
      admin.id,
    );
    const terminated = await harness.staffManagement.getStaff(
      staffId,
      schoolId,
      admin.id,
    );
    expect(terminated).toMatchObject({
      employmentStatus: 'TERMINATED',
      terminationDate: date,
    });

    const rehire = await harness.staffManagement.rehire(
      staffId,
      {
        schoolId,
        rowVersion: terminated.rowVersion,
        effectiveDate: date,
        reason: 'New employment agreement approved.',
        jobTitle: 'Finance Officer',
        department: 'Finance and Operations',
      },
      admin.id,
    );
    expect(rehire).toMatchObject({
      staff: {
        employmentStatus: 'ACTIVE',
        terminationDate: null,
        jobTitle: 'Finance Officer',
      },
      effects: { accessReviewRequired: true },
    });

    const periods = await pool.query<{
      start_date: string;
      end_date: string | null;
    }>(
      `
      SELECT start_date::TEXT, end_date::TEXT
      FROM staff_employment_periods
      WHERE school_id = $1
        AND staff_account_id = $2
        AND deleted_at IS NULL
      ORDER BY created_at
      `,
      [schoolId, staffId],
    );
    expect(periods.rows).toHaveLength(2);
    expect(periods.rows[0].end_date).toBe(date);
    expect(periods.rows[1]).toEqual({ start_date: date, end_date: null });
  });

  it('rejects cross-school management and self-suspension', async () => {
    const firstSchoolId = await factory.school();
    const secondSchoolId = await factory.school();
    const firstAdmin = await administrator(firstSchoolId);
    const secondAdmin = await administrator(secondSchoolId);

    await expect(
      harness.staffManagement.listStaff(
        { schoolId: firstSchoolId, page: 1, pageSize: 25 },
        secondAdmin.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      harness.staffManagement.getStaffMedical(
        firstAdmin.staffId,
        firstSchoolId,
        secondAdmin.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const ownRecord = await harness.staffManagement.getStaff(
      firstAdmin.staffId,
      firstSchoolId,
      firstAdmin.id,
    );
    await expect(
      harness.staffManagement.suspend(
        firstAdmin.staffId,
        {
          schoolId: firstSchoolId,
          rowVersion: ownRecord.rowVersion,
          effectiveDate: new Date().toISOString().slice(0, 10),
          reason: 'Attempted self suspension.',
        },
        firstAdmin.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('previews CSV staff imports without mutation and rejects school-scope bypasses', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    await harness.staffManagement.createStaff(
      {
        schoolId,
        firstName: 'Existing',
        lastName: 'Employee',
        email: 'existing@example.test',
        staffCode: 'existing-001',
        staffCategory: 'ADMINISTRATIVE',
        employmentType: 'FULL_TIME',
        employmentStatus: 'DRAFT',
      },
      admin.id,
    );
    const before = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM school_staff_accounts WHERE school_id = $1`,
      [schoolId],
    );
    const futureDate = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);

    const preview = await harness.staffManagement.previewStaffImport(
      {
        schoolId,
        rows: [
          {
            rowNumber: 2,
            firstName: '  Jean ',
            lastName: ' Pierre  ',
            email: ' JEAN.PIERRE@EXAMPLE.TEST ',
            staffCategory: ' teaching ',
            employmentType: ' full_time ',
            jobTitle: 'Teacher',
          },
          {
            rowNumber: 3,
            firstName: 'Duplicate',
            lastName: 'One',
            email: 'duplicate@example.test',
            staffCode: 'DUP-001',
            staffCategory: 'SUPPORT',
            employmentType: 'PART_TIME',
          },
          {
            rowNumber: 4,
            firstName: 'Duplicate',
            lastName: 'Two',
            email: 'DUPLICATE@EXAMPLE.TEST',
            staffCode: 'DUP-002',
            staffCategory: 'SUPPORT',
            employmentType: 'PART_TIME',
          },
          {
            rowNumber: 5,
            firstName: 'Existing',
            lastName: 'Conflict',
            email: 'existing@example.test',
            staffCode: 'EXISTING-001',
            staffCategory: 'FINANCE',
            employmentType: 'FULL_TIME',
          },
          {
            rowNumber: 6,
            firstName: ' ',
            lastName: '',
            email: 'not-an-email',
            staffCode: 'invalid code',
            staffCategory: 'UNSUPPORTED',
            employmentType: 'PERMANENT',
            hireDate: futureDate,
          },
        ],
      },
      admin.id,
    );

    expect(preview).toMatchObject({
      importMode: 'DRAFT_ONLY',
      readyForImport: false,
      summary: {
        totalRows: 5,
        validRows: 1,
        invalidRows: 4,
      },
    });
    expect(preview.rows[0]).toMatchObject({
      rowNumber: 2,
      valid: true,
      normalized: {
        firstName: 'Jean',
        lastName: 'Pierre',
        email: 'jean.pierre@example.test',
        staffCode: null,
        staffCategory: 'TEACHING',
        employmentType: 'FULL_TIME',
        employmentStatus: 'DRAFT',
      },
    });
    expect(preview.rows[0].warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'STAFF_CODE_WILL_BE_GENERATED' }),
      ]),
    );
    for (const index of [1, 2]) {
      expect(preview.rows[index].errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'DUPLICATE_EMAIL_IN_FILE' }),
        ]),
      );
    }
    expect(preview.rows[3].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'EMAIL_ALREADY_EXISTS' }),
        expect.objectContaining({ code: 'STAFF_CODE_ALREADY_EXISTS' }),
      ]),
    );
    expect(preview.rows[4].errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'FIRST_NAME_REQUIRED',
        'LAST_NAME_REQUIRED',
        'INVALID_EMAIL',
        'INVALID_STAFF_CODE',
        'INVALID_STAFF_CATEGORY',
        'INVALID_EMPLOYMENT_TYPE',
        'FUTURE_HIRE_DATE',
      ]),
    );

    const after = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM school_staff_accounts WHERE school_id = $1`,
      [schoolId],
    );
    expect(after.rows[0].count).toBe(before.rows[0].count);

    const otherSchoolId = await factory.school();
    await expect(
      harness.staffManagement.previewStaffImport(
        {
          schoolId: otherSchoolId,
          rows: [
            {
              rowNumber: 2,
              firstName: 'Cross',
              lastName: 'School',
              staffCategory: 'SUPPORT',
              employmentType: 'FULL_TIME',
            },
          ],
        },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces the transition matrix and append-only lifecycle history', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const created = await harness.staffManagement.createStaff(
      {
        schoolId,
        firstName: 'Draft',
        lastName: 'Employee',
        staffCategory: 'SUPPORT',
        employmentType: 'TEMPORARY',
        employmentStatus: 'DRAFT',
      },
      admin.id,
    );
    const date = new Date().toISOString().slice(0, 10);

    await expect(
      harness.staffManagement.terminate(
        created.id,
        {
          schoolId,
          rowVersion: created.rowVersion,
          effectiveDate: date,
          reason: 'Invalid draft termination.',
        },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const history = await harness.staffManagement.getHistory(
      created.id,
      schoolId,
      admin.id,
    );
    await expect(
      pool.query(
        `UPDATE staff_status_events SET reason = 'Tampered' WHERE id = $1`,
        [history.statusEvents[0].id],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });
});
