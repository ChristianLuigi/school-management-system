import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PasswordService } from '../../src/auth/security/password.service';
import { SessionTokenService } from '../../src/auth/security/session-token.service';

export type SchoolRole =
  | 'SCHOOL_ADMIN'
  | 'TEACHER'
  | 'FINANCE_ADMIN'
  | 'PARENT';

export type TestUser = {
  id: string;
  email: string;
  password: string;
};

export class IntegrationFactory {
  constructor(
    private readonly pool: Pool,
    private readonly passwords: PasswordService,
    private readonly sessionTokens: SessionTokenService,
  ) {}

  async school(input?: { name?: string; managementMode?: string }) {
    const id = randomUUID();
    const suffix = id.slice(0, 8);
    await this.pool.query(
      `
      INSERT INTO schools (
        id,
        code,
        name,
        currency_code,
        country_code,
        timezone,
        status,
        management_mode
      )
      VALUES ($1, $2, $3, 'HTG', 'HT', 'America/Port-au-Prince', 'ACTIVE', $4)
      `,
      [
        id,
        `TEST-${suffix}`,
        input?.name ?? `Test School ${suffix}`,
        input?.managementMode ?? 'SELF_MANAGED',
      ],
    );
    return id;
  }

  async user(input?: {
    email?: string;
    password?: string;
    accountStatus?: string;
    platformRole?: 'SUPER_ADMIN' | null;
    verified?: boolean;
  }): Promise<TestUser> {
    const id = randomUUID();
    const email =
      input?.email ?? `user-${id.slice(0, 12)}@release.test`;
    const password =
      input?.password ?? 'Release Pilot Password 84!Cobalt';
    const passwordHash = await this.passwords.hash(password);
    const accountStatus = input?.accountStatus ?? 'ACTIVE';
    const verified = input?.verified ?? true;

    await this.pool.query(
      `
      INSERT INTO users (
        id,
        email,
        email_original,
        email_normalized,
        password_hash,
        preferred_locale,
        status,
        account_status,
        email_verified_at,
        password_changed_at,
        authentication_version,
        platform_role,
        first_name,
        last_name
      )
      VALUES (
        $1,
        $2::text,
        $2::text,
        $2::text,
        $3,
        'fr',
        'ACTIVE',
        $4,
        CASE WHEN $5::boolean THEN NOW() ELSE NULL END,
        NOW(),
        1,
        $6,
        'Release',
        'Tester'
      )
      `,
      [
        id,
        email.toLowerCase(),
        passwordHash,
        accountStatus,
        verified,
        input?.platformRole ?? null,
      ],
    );

    return { id, email: email.toLowerCase(), password };
  }

  async membership(schoolId: string, userId: string, role: SchoolRole) {
    const membershipResult = await this.pool.query<{ id: string }>(
      `
      INSERT INTO school_memberships (
        school_id,
        user_id,
        membership_status,
        joined_at,
        activated_at,
        is_primary
      )
      VALUES ($1, $2, 'ACTIVE', NOW(), NOW(), TRUE)
      ON CONFLICT (school_id, user_id) WHERE deleted_at IS NULL
      DO UPDATE SET membership_status = 'ACTIVE', updated_at = NOW()
      RETURNING id
      `,
      [schoolId, userId],
    );
    const membershipId = membershipResult.rows[0].id;

    await this.pool.query(
      `
      INSERT INTO school_membership_roles (school_membership_id, role)
      VALUES ($1, $2::school_staff_role)
      ON CONFLICT (school_membership_id, role) WHERE deleted_at IS NULL
      DO NOTHING
      `,
      [membershipId, role],
    );
    await this.pool.query(
      `
      INSERT INTO school_user_roles (school_id, user_id, role, is_primary)
      VALUES ($1, $2, $3::school_role, TRUE)
      ON CONFLICT (school_id, user_id, role) DO NOTHING
      `,
      [schoolId, userId, role],
    );

    return membershipId;
  }

  async session(userId: string, input?: { expired?: boolean; revoked?: boolean }) {
    const { rawToken, tokenHash } = this.sessionTokens.generate();
    const expiresAt = input?.expired
      ? new Date(Date.now() - 60_000)
      : new Date(Date.now() + 3_600_000);
    const idleExpiresAt = input?.expired
      ? new Date(Date.now() - 60_000)
      : new Date(Date.now() + 1_800_000);

    const result = await this.pool.query<{ id: string }>(
      `
      INSERT INTO auth_sessions (
        user_id,
        token_hash,
        authentication_version,
        last_seen_at,
        idle_expires_at,
        expires_at,
        revoked_at,
        revocation_reason
      )
      SELECT
        id,
        $2,
        authentication_version,
        NOW(),
        $3,
        $4,
        CASE WHEN $5::boolean THEN NOW() ELSE NULL END,
        CASE WHEN $5::boolean THEN 'TEST_REVOKED' ELSE NULL END
      FROM users
      WHERE id = $1
      RETURNING id
      `,
      [userId, tokenHash, idleExpiresAt, expiresAt, input?.revoked ?? false],
    );

    return { id: result.rows[0].id, rawToken, tokenHash };
  }

  async guardian(schoolId: string, input?: { userId?: string; email?: string }) {
    const id = randomUUID();
    await this.pool.query(
      `
      INSERT INTO guardians (
        id,
        school_id,
        user_id,
        first_name,
        last_name,
        full_name,
        email,
        receive_attendance_alerts,
        receive_finance_alerts
      )
      VALUES ($1, $2, $3, 'Guardian', 'Tester', 'Guardian Tester', $4, TRUE, TRUE)
      `,
      [id, schoolId, input?.userId ?? null, input?.email ?? null],
    );
    return id;
  }

  async student(schoolId: string) {
    const id = randomUUID();
    await this.pool.query(
      `
      INSERT INTO students (
        id,
        school_id,
        student_number,
        first_name,
        last_name,
        status
      )
      VALUES ($1, $2, $3, 'Student', 'Tester', 'ACTIVE')
      `,
      [id, schoolId, `STU-${id.slice(0, 8)}`],
    );
    return id;
  }

  async studentGuardian(
    schoolId: string,
    studentId: string,
    guardianId: string,
  ) {
    const id = randomUUID();
    await this.pool.query(
      `
      INSERT INTO student_guardians (
        id,
        school_id,
        student_id,
        guardian_id,
        relationship,
        relationship_type,
        can_view_finance,
        can_view_academics
      )
      VALUES ($1, $2, $3, $4, 'PARENT', 'PARENT', TRUE, TRUE)
      `,
      [id, schoolId, studentId, guardianId],
    );
    return id;
  }

  async academicScope(schoolId: string) {
    const academicYearId = randomUUID();
    const gradeLevelId = randomUUID();
    const sectionId = randomUUID();
    const subjectId = randomUUID();

    await this.pool.query(
      `
      INSERT INTO academic_years (
        id,
        school_id,
        name_i18n,
        start_date,
        end_date,
        status
      )
      VALUES ($1, $2, '{"fr":"2026-2027","en":"2026-2027"}', '2026-09-01', '2027-06-30', 'ACTIVE')
      `,
      [academicYearId, schoolId],
    );
    await this.pool.query(
      `
      INSERT INTO grade_levels (
        id,
        school_id,
        code,
        name_i18n,
        display_order
      )
      VALUES ($1, $2, $3, '{"fr":"Classe test","en":"Test grade"}', 1)
      `,
      [gradeLevelId, schoolId, `GRADE-${gradeLevelId.slice(0, 8)}`],
    );
    await this.pool.query(
      `
      INSERT INTO sections (
        id,
        school_id,
        academic_year_id,
        grade_level_id,
        code,
        name_i18n
      )
      VALUES ($1, $2, $3, $4, 'A', '{"fr":"A","en":"A"}')
      `,
      [sectionId, schoolId, academicYearId, gradeLevelId],
    );
    await this.pool.query(
      `
      INSERT INTO school_subjects (id, school_id, code, name_i18n)
      VALUES ($1, $2, $3, '{"fr":"Mathématiques","en":"Mathematics"}')
      `,
      [subjectId, schoolId, `MATH-${subjectId.slice(0, 8)}`],
    );
    await this.pool.query(
      `
      INSERT INTO grade_level_subjects (
        school_id,
        grade_level_id,
        subject_id
      )
      VALUES ($1, $2, $3)
      `,
      [schoolId, gradeLevelId, subjectId],
    );

    return {
      academicYearId,
      gradeLevelId,
      sectionId,
      subjectId,
    };
  }

  async enrollment(
    studentId: string,
    scope: {
      academicYearId: string;
      gradeLevelId: string;
      sectionId: string;
    },
  ) {
    const id = randomUUID();
    await this.pool.query(
      `
      INSERT INTO enrollments (
        id,
        student_id,
        academic_year_id,
        grade_level_id,
        section_id,
        enrollment_status,
        start_date
      )
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE', '2026-09-01')
      `,
      [
        id,
        studentId,
        scope.academicYearId,
        scope.gradeLevelId,
        scope.sectionId,
      ],
    );
    return id;
  }
  async teacherAssignment(
    schoolId: string,
    teacherUserId: string,
    scope: {
      academicYearId: string;
      sectionId: string;
      subjectId: string;
    },
    assignedByUserId: string,
  ) {
    const id = randomUUID();
    await this.pool.query(
      `
      INSERT INTO teacher_academic_assignments (
        id,
        school_id,
        teacher_user_id,
        academic_year_id,
        section_id,
        subject_id,
        assignment_status,
        assigned_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7)
      `,
      [
        id,
        schoolId,
        teacherUserId,
        scope.academicYearId,
        scope.sectionId,
        scope.subjectId,
        assignedByUserId,
      ],
    );
    return id;
  }

  async guardianAccountLink(
    schoolId: string,
    parentUserId: string,
    guardianId: string,
    actorUserId: string,
  ) {
    const id = randomUUID();
    await this.pool.query(
      `
      INSERT INTO guardian_account_links (
        id,
        school_id,
        user_id,
        guardian_id,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [id, schoolId, parentUserId, guardianId, actorUserId],
    );
    return id;
  }
}
