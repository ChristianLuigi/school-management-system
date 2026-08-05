import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { InvitationsService } from '../auth/invitations.service';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { CreateStaffAccountInvitationDto } from './dto/create-staff-account-invitation.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { LinkStaffUserDto } from './dto/link-staff-user.dto';
import { ListStaffDto } from './dto/list-staff.dto';
import { RehireStaffDto } from './dto/rehire-staff.dto';
import { StaffLifecycleActionDto } from './dto/staff-lifecycle-action.dto';
import { UnlinkStaffUserDto } from './dto/unlink-staff-user.dto';
import { UpdateStaffMedicalDto } from './dto/update-staff-medical.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

type EmploymentStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'ARCHIVED';

type StaffRecord = {
  id: string;
  school_id: string;
  user_id: string | null;
  staff_type: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN' | null;
  staff_code: string | null;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email_original: string | null;
  email_normalized: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_city: string | null;
  address_region: string | null;
  address_postal_code: string | null;
  address_country_code: string | null;
  staff_category: string;
  employment_type: string;
  employment_status: EmploymentStatus;
  hire_date: string | null;
  termination_date: string | null;
  job_title: string | null;
  department: string | null;
  supervisor_staff_account_id: string | null;
  work_location: string | null;
  status_effective_date: string;
  status_reason: string;
  row_version: number;
  created_at: string;
  updated_at: string;
};

type StaffMedicalRecord = {
  id: string;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  allergies_or_conditions: string | null;
  accommodation_notes: string | null;
  row_version: number;
  updated_at: string;
};
type QueryTarget = {
  query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

const POSITION_FIELDS = [
  'jobTitle',
  'department',
  'supervisorStaffAccountId',
  'workLocation',
] as const;

@Injectable()
export class StaffManagementService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
    private readonly invitationsService: InvitationsService,
  ) {}

  private hasOwn(value: object, key: string) {
    return Boolean(Object.prototype.hasOwnProperty.call(value, key));
  }

  private trim(value: string | undefined | null) {
    return value?.trim() || null;
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private dateOnly(value: string | Date | null) {
    if (!value) return null;
    return value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  }

  private validateEffectiveDate(
    effectiveDate: string,
    currentEffectiveDate?: string | Date,
  ) {
    if (effectiveDate > this.today()) {
      throw new BadRequestException(
        'Staff lifecycle changes cannot be future-dated.',
      );
    }
    const current = this.dateOnly(currentEffectiveDate ?? null);
    if (current && effectiveDate < current) {
      throw new BadRequestException(
        'Staff lifecycle changes cannot move backwards in time.',
      );
    }
  }

  private async assertSchoolAdministrator(
    target: QueryTarget,
    schoolId: string,
    actorUserId: string,
  ) {
    const result = await target.query(
      `
      SELECT membership.id
      FROM school_memberships membership
      JOIN school_membership_roles role
        ON role.school_membership_id = membership.id
       AND role.role::TEXT = 'SCHOOL_ADMIN'
       AND role.deleted_at IS NULL
      JOIN school_staff_accounts staff
        ON staff.school_id = membership.school_id
       AND staff.user_id = membership.user_id
       AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
       AND staff.deleted_at IS NULL
      WHERE membership.school_id = $1
        AND membership.user_id = $2
        AND membership.membership_status = 'ACTIVE'
        AND membership.deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId, actorUserId],
    );
    if (!result.rowCount) {
      throw new ForbiddenException(
        'Active School Administrator access is required.',
      );
    }
  }

  private async assertSupervisor(
    target: QueryTarget,
    schoolId: string,
    staffId: string | null,
  ) {
    if (!staffId) return;
    const result = await target.query(
      `
      SELECT id
      FROM school_staff_accounts
      WHERE id = $1
        AND school_id = $2
        AND employment_status NOT IN ('TERMINATED', 'ARCHIVED')
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [staffId, schoolId],
    );
    if (!result.rowCount) {
      throw new BadRequestException(
        'The selected supervisor is unavailable for this school.',
      );
    }
  }

  private async lockStaff(
    client: PoolClient,
    schoolId: string,
    staffId: string,
  ) {
    const result = await client.query<StaffRecord>(
      `
      SELECT
        id,
        school_id,
        user_id,
        staff_type,
        staff_code,
        first_name,
        last_name,
        preferred_name,
        email_original,
        email_normalized,
        phone,
        address_line_1,
        address_line_2,
        address_city,
        address_region,
        address_postal_code,
        address_country_code,
        staff_category,
        employment_type,
        employment_status,
        hire_date,
        termination_date,
        job_title,
        department,
        supervisor_staff_account_id,
        work_location,
        status_effective_date,
        status_reason,
        row_version,
        created_at,
        updated_at
      FROM school_staff_accounts
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [staffId, schoolId],
    );
    const staff = result.rows[0];
    if (!staff) {
      throw new NotFoundException('Staff record not found.');
    }
    return staff;
  }

  private assertVersion(staff: StaffRecord, rowVersion: number) {
    if (staff.row_version !== rowVersion) {
      throw new ConflictException(
        'This staff record was changed by another user. Refresh and try again.',
      );
    }
  }

  private assertRoleMatchesStaff(
    staff: StaffRecord,
    roleCode: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN',
  ) {
    const expectedCategory = {
      SCHOOL_ADMIN: 'SCHOOL_LEADERSHIP',
      TEACHER: 'TEACHING',
      FINANCE_ADMIN: 'FINANCE',
    }[roleCode];
    if (staff.staff_category !== expectedCategory) {
      throw new BadRequestException(
        `The ${roleCode} role does not match this staff record category.`,
      );
    }
  }

  private mapStaff(row: StaffRecord & Record<string, unknown>) {
    return {
      id: row.id,
      schoolId: row.school_id,
      userId: row.user_id,
      staffCode: row.staff_code,
      firstName: row.first_name,
      lastName: row.last_name,
      preferredName: row.preferred_name,
      email: row.email_original,
      phone: row.phone,
      addressLine1: row.address_line_1,
      addressLine2: row.address_line_2,
      addressCity: row.address_city,
      addressRegion: row.address_region,
      addressPostalCode: row.address_postal_code,
      addressCountryCode: row.address_country_code,
      staffCategory: row.staff_category,
      employmentType: row.employment_type,
      employmentStatus: row.employment_status,
      hireDate: this.dateOnly(row.hire_date),
      terminationDate: this.dateOnly(row.termination_date),
      jobTitle: row.job_title,
      department: row.department,
      supervisorStaffAccountId: row.supervisor_staff_account_id,
      workLocation: row.work_location,
      statusEffectiveDate: this.dateOnly(row.status_effective_date),
      statusReason: row.status_reason,
      rowVersion: row.row_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rethrowDatabaseError(error: unknown): never {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : '';
    const constraint =
      typeof error === 'object' && error && 'constraint' in error
        ? String(error.constraint)
        : '';

    if (code === '23505') {
      if (constraint.includes('staff_code')) {
        throw new ConflictException(
          'That staff code is already used in this school.',
        );
      }
      if (constraint.includes('staff_email')) {
        throw new ConflictException(
          'That email address is already used by another staff record.',
        );
      }
      throw new ConflictException(
        'The staff record conflicts with existing data.',
      );
    }
    if (code === '23503') {
      throw new BadRequestException(
        'A referenced school or staff record is unavailable.',
      );
    }
    if (code === '23514' || code === 'P0001') {
      throw new BadRequestException(
        'The requested staff change violates an employment lifecycle rule.',
      );
    }
    throw error;
  }

  async listStaff(query: ListStaffDto, actorUserId: string) {
    await this.assertSchoolAdministrator(this.db, query.schoolId, actorUserId);

    const values: unknown[] = [query.schoolId];
    const where = ['staff.school_id = $1', 'staff.deleted_at IS NULL'];

    if (query.search?.trim()) {
      values.push(`%${query.search.trim()}%`);
      where.push(`(
        staff.staff_code ILIKE $${values.length}
        OR staff.first_name ILIKE $${values.length}
        OR staff.last_name ILIKE $${values.length}
        OR staff.preferred_name ILIKE $${values.length}
        OR staff.email_original ILIKE $${values.length}
        OR staff.job_title ILIKE $${values.length}
        OR staff.department ILIKE $${values.length}
      )`);
    }
    if (query.employmentStatus) {
      values.push(query.employmentStatus);
      where.push(`staff.employment_status = $${values.length}`);
    }
    if (query.staffCategory) {
      values.push(query.staffCategory);
      where.push(`staff.staff_category = $${values.length}`);
    }
    if (query.employmentType) {
      values.push(query.employmentType);
      where.push(`staff.employment_type = $${values.length}`);
    }
    if (query.department?.trim()) {
      values.push(query.department.trim());
      where.push(`LOWER(staff.department) = LOWER($${values.length})`);
    }
    if (query.accountLink) {
      where.push(
        query.accountLink === 'LINKED'
          ? 'staff.user_id IS NOT NULL'
          : 'staff.user_id IS NULL',
      );
    }
    if (query.payrollProfile) {
      where.push(
        query.payrollProfile === 'WITH'
          ? 'payroll.id IS NOT NULL'
          : 'payroll.id IS NULL',
      );
    }
    if (query.assignments) {
      where.push(
        query.assignments === 'WITH'
          ? 'COALESCE(assignment_stats.assignment_count, 0) > 0'
          : 'COALESCE(assignment_stats.assignment_count, 0) = 0',
      );
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    values.push(pageSize, (page - 1) * pageSize);
    const result = await this.db.query<
      StaffRecord & {
        total_count: string;
        linked_account_status: string | null;
        email_verified_at: string | null;
        payroll_profile_id: string | null;
        payroll_active: boolean | null;
        assignment_count: string;
      }
    >(
      `
      SELECT
        staff.*,
        COUNT(*) OVER()::TEXT AS total_count,
        usr.account_status AS linked_account_status,
        usr.email_verified_at,
        payroll.id AS payroll_profile_id,
        payroll.payroll_active,
        COALESCE(
          assignment_stats.assignment_count,
          0
        )::TEXT AS assignment_count
      FROM school_staff_accounts staff
      LEFT JOIN users usr
        ON usr.id = staff.user_id
       AND usr.deleted_at IS NULL
      LEFT JOIN payroll_staff_profiles payroll
        ON payroll.school_id = staff.school_id
       AND payroll.school_staff_account_id = staff.id
       AND payroll.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS assignment_count
        FROM teacher_academic_assignments assignment
        WHERE assignment.school_id = staff.school_id
          AND assignment.teacher_staff_account_id = staff.id
          AND assignment.assignment_status = 'ACTIVE'
          AND assignment.deleted_at IS NULL
      ) assignment_stats ON TRUE
      WHERE ${where.join(' AND ')}
      ORDER BY
        staff.last_name ASC NULLS LAST,
        staff.first_name ASC NULLS LAST,
        staff.staff_code ASC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values,
    );

    let total = Number(result.rows[0]?.total_count ?? 0);
    if (!result.rows.length && page > 1) {
      const countResult = await this.db.query<{ total_count: string }>(
        `
        SELECT COUNT(*)::TEXT AS total_count
        FROM school_staff_accounts staff
        LEFT JOIN payroll_staff_profiles payroll
          ON payroll.school_id = staff.school_id
         AND payroll.school_staff_account_id = staff.id
         AND payroll.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS assignment_count
          FROM teacher_academic_assignments assignment
          WHERE assignment.school_id = staff.school_id
            AND assignment.teacher_staff_account_id = staff.id
            AND assignment.assignment_status = 'ACTIVE'
            AND assignment.deleted_at IS NULL
        ) assignment_stats ON TRUE
        WHERE ${where.join(' AND ')}
        `,
        values.slice(0, -2),
      );
      total = Number(countResult.rows[0]?.total_count ?? 0);
    }
    return {
      items: result.rows.map((row) => ({
        ...this.mapStaff(row),
        account: row.user_id
          ? {
              linked: true,
              status: row.linked_account_status,
              emailVerified: Boolean(row.email_verified_at),
            }
          : { linked: false, status: null, emailVerified: false },
        payroll: {
          hasProfile: Boolean(row.payroll_profile_id),
          active: Boolean(row.payroll_active),
        },
        activeAssignmentCount: Number(row.assignment_count),
      })),
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async createStaff(dto: CreateStaffDto, actorUserId: string) {
    try {
      return await this.db.withTransaction(async (client) => {
        await this.assertSchoolAdministrator(client, dto.schoolId, actorUserId);
        await this.assertSupervisor(
          client,
          dto.schoolId,
          dto.supervisorStaffAccountId ?? null,
        );

        const status = dto.employmentStatus ?? 'DRAFT';
        const hireDate =
          dto.hireDate ?? (status === 'ACTIVE' ? this.today() : null);
        const reason =
          this.trim(dto.reason) ??
          (status === 'ACTIVE'
            ? 'Staff member added as active.'
            : 'Staff draft created.');
        const effectiveDate = hireDate ?? this.today();
        this.validateEffectiveDate(effectiveDate);

        const result = await client.query<StaffRecord>(
          `
          INSERT INTO school_staff_accounts (
            school_id,
            staff_code,
            first_name,
            last_name,
            preferred_name,
            email_original,
            phone,
            address_line_1,
            address_line_2,
            address_city,
            address_region,
            address_postal_code,
            address_country_code,
            staff_category,
            employment_type,
            employment_status,
            hire_date,
            job_title,
            department,
            supervisor_staff_account_id,
            work_location,
            status_effective_date,
            status_reason,
            employment_status_changed_by_user_id,
            created_by_user_id
          )
          VALUES (
            $1,
            COALESCE($2, next_school_staff_code($1)),
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            $20,
            $21,
            $22,
            $23,
            $24,
            $24
          )
          RETURNING *
          `,
          [
            dto.schoolId,
            this.trim(dto.staffCode),
            dto.firstName.trim(),
            dto.lastName.trim(),
            this.trim(dto.preferredName),
            this.trim(dto.email),
            this.trim(dto.phone),
            this.trim(dto.addressLine1),
            this.trim(dto.addressLine2),
            this.trim(dto.addressCity),
            this.trim(dto.addressRegion),
            this.trim(dto.addressPostalCode),
            this.trim(dto.addressCountryCode)?.toUpperCase() ?? null,
            dto.staffCategory,
            dto.employmentType,
            status,
            hireDate,
            this.trim(dto.jobTitle),
            this.trim(dto.department),
            dto.supervisorStaffAccountId ?? null,
            this.trim(dto.workLocation),
            effectiveDate,
            reason,
            actorUserId,
          ],
        );
        const staff = result.rows[0];

        await this.platformActivityService.recordTx(client, {
          eventType: 'SCHOOL_STAFF_CREATED',
          actorType: 'SCHOOL_STAFF',
          actorUserId,
          schoolId: dto.schoolId,
          summary: 'School staff record created.',
          payload: {
            staffAccountId: staff.id,
            staffCode: staff.staff_code,
            employmentStatus: staff.employment_status,
          },
        });
        return this.mapStaff(staff);
      });
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async getStaff(staffId: string, schoolId: string, actorUserId: string) {
    await this.assertSchoolAdministrator(this.db, schoolId, actorUserId);
    const result = await this.db.query<
      StaffRecord & {
        supervisor_first_name: string | null;
        supervisor_last_name: string | null;
        linked_account_status: string | null;
        email_verified_at: string | null;
        last_login_at: string | null;
      }
    >(
      `
      SELECT
        staff.*,
        supervisor.first_name AS supervisor_first_name,
        supervisor.last_name AS supervisor_last_name,
        usr.account_status AS linked_account_status,
        usr.email_verified_at,
        usr.last_login_at
      FROM school_staff_accounts staff
      LEFT JOIN school_staff_accounts supervisor
        ON supervisor.id = staff.supervisor_staff_account_id
       AND supervisor.school_id = staff.school_id
       AND supervisor.deleted_at IS NULL
      LEFT JOIN users usr
        ON usr.id = staff.user_id
       AND usr.deleted_at IS NULL
      WHERE staff.id = $1
        AND staff.school_id = $2
        AND staff.deleted_at IS NULL
      LIMIT 1
      `,
      [staffId, schoolId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Staff record not found.');
    return {
      ...this.mapStaff(row),
      supervisor: row.supervisor_staff_account_id
        ? {
            id: row.supervisor_staff_account_id,
            firstName: row.supervisor_first_name,
            lastName: row.supervisor_last_name,
          }
        : null,
      account: row.user_id
        ? {
            linked: true,
            status: row.linked_account_status,
            emailVerifiedAt: row.email_verified_at,
            lastLoginAt: row.last_login_at,
          }
        : null,
    };
  }

  async updateStaff(staffId: string, dto: UpdateStaffDto, actorUserId: string) {
    try {
      return await this.db.withTransaction(async (client) => {
        await this.assertSchoolAdministrator(client, dto.schoolId, actorUserId);
        const staff = await this.lockStaff(client, dto.schoolId, staffId);
        this.assertVersion(staff, dto.rowVersion);
        if (staff.employment_status === 'ARCHIVED') {
          throw new BadRequestException(
            'Archived staff records are read-only.',
          );
        }

        const positionChanged = POSITION_FIELDS.some((field) =>
          this.hasOwn(dto, field),
        );
        if (positionChanged) {
          if (!dto.effectiveDate || !this.trim(dto.changeReason)) {
            throw new BadRequestException(
              'Position changes require an effective date and reason.',
            );
          }
          this.validateEffectiveDate(
            dto.effectiveDate,
            staff.status_effective_date,
          );
        }
        if (this.hasOwn(dto, 'supervisorStaffAccountId')) {
          if (dto.supervisorStaffAccountId === staffId) {
            throw new BadRequestException(
              'A staff member cannot supervise themselves.',
            );
          }
          await this.assertSupervisor(
            client,
            dto.schoolId,
            dto.supervisorStaffAccountId ?? null,
          );
        }

        const updates: string[] = [];
        const values: unknown[] = [staffId, dto.schoolId, dto.rowVersion];
        const add = (column: string, value: unknown) => {
          values.push(value);
          updates.push(`${column} = $${values.length}`);
        };
        if (this.hasOwn(dto, 'firstName'))
          add('first_name', this.trim(dto.firstName));
        if (this.hasOwn(dto, 'lastName'))
          add('last_name', this.trim(dto.lastName));
        if (this.hasOwn(dto, 'preferredName'))
          add('preferred_name', this.trim(dto.preferredName));
        if (this.hasOwn(dto, 'email'))
          add('email_original', this.trim(dto.email));
        if (this.hasOwn(dto, 'phone')) add('phone', this.trim(dto.phone));
        if (this.hasOwn(dto, 'addressLine1'))
          add('address_line_1', this.trim(dto.addressLine1));
        if (this.hasOwn(dto, 'addressLine2'))
          add('address_line_2', this.trim(dto.addressLine2));
        if (this.hasOwn(dto, 'addressCity'))
          add('address_city', this.trim(dto.addressCity));
        if (this.hasOwn(dto, 'addressRegion'))
          add('address_region', this.trim(dto.addressRegion));
        if (this.hasOwn(dto, 'addressPostalCode'))
          add('address_postal_code', this.trim(dto.addressPostalCode));
        if (this.hasOwn(dto, 'addressCountryCode'))
          add(
            'address_country_code',
            this.trim(dto.addressCountryCode)?.toUpperCase() ?? null,
          );
        if (this.hasOwn(dto, 'staffCode'))
          add('staff_code', this.trim(dto.staffCode));
        if (this.hasOwn(dto, 'staffCategory'))
          add('staff_category', dto.staffCategory);
        if (this.hasOwn(dto, 'employmentType'))
          add('employment_type', dto.employmentType);
        if (this.hasOwn(dto, 'hireDate')) add('hire_date', dto.hireDate);
        if (this.hasOwn(dto, 'jobTitle'))
          add('job_title', this.trim(dto.jobTitle));
        if (this.hasOwn(dto, 'department'))
          add('department', this.trim(dto.department));
        if (this.hasOwn(dto, 'workLocation'))
          add('work_location', this.trim(dto.workLocation));
        if (this.hasOwn(dto, 'supervisorStaffAccountId'))
          add(
            'supervisor_staff_account_id',
            dto.supervisorStaffAccountId ?? null,
          );

        if (!updates.length) {
          throw new BadRequestException('No staff fields were supplied.');
        }

        const updatedResult = await client.query<StaffRecord>(
          `
          UPDATE school_staff_accounts
          SET ${updates.join(', ')}
          WHERE id = $1
            AND school_id = $2
            AND row_version = $3
            AND deleted_at IS NULL
          RETURNING *
          `,
          values,
        );
        const updated = updatedResult.rows[0];
        if (!updated) {
          throw new ConflictException(
            'This staff record was changed by another user. Refresh and try again.',
          );
        }

        if (positionChanged) {
          await client.query(
            `
            UPDATE staff_position_assignments
            SET
              end_date = $3,
              updated_at = NOW()
            WHERE school_id = $1
              AND staff_account_id = $2
              AND end_date IS NULL
              AND deleted_at IS NULL
              AND is_primary = TRUE
            `,
            [dto.schoolId, staffId, dto.effectiveDate],
          );
          if (
            updated.job_title ||
            updated.department ||
            updated.supervisor_staff_account_id ||
            updated.work_location
          ) {
            await client.query(
              `
              INSERT INTO staff_position_assignments (
                school_id,
                staff_account_id,
                position_title,
                department,
                supervisor_staff_account_id,
                work_location,
                start_date,
                is_primary,
                change_reason,
                created_by_user_id
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9)
              `,
              [
                dto.schoolId,
                staffId,
                updated.job_title,
                updated.department,
                updated.supervisor_staff_account_id,
                updated.work_location,
                dto.effectiveDate,
                dto.changeReason?.trim(),
                actorUserId,
              ],
            );
          }
        }

        await this.platformActivityService.recordTx(client, {
          eventType: 'SCHOOL_STAFF_UPDATED',
          actorType: 'SCHOOL_STAFF',
          actorUserId,
          schoolId: dto.schoolId,
          summary: 'School staff record updated.',
          payload: {
            staffAccountId: staffId,
            changedFields: updates.map((item) => item.split(' = ')[0]),
            positionHistoryUpdated: positionChanged,
          },
        });
        return this.mapStaff(updated);
      });
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  private async assertLifecycleSafety(
    client: PoolClient,
    staff: StaffRecord,
    actorUserId: string,
    targetStatus: EmploymentStatus,
  ) {
    if (
      staff.user_id === actorUserId &&
      ['SUSPENDED', 'TERMINATED', 'ARCHIVED'].includes(targetStatus)
    ) {
      throw new BadRequestException(
        'You cannot remove your own active staff access.',
      );
    }
    if (
      !staff.user_id ||
      !['SUSPENDED', 'TERMINATED', 'ARCHIVED'].includes(targetStatus)
    ) {
      return;
    }
    const roleResult = await client.query(
      `
      SELECT 1
      FROM school_memberships membership
      JOIN school_membership_roles role
        ON role.school_membership_id = membership.id
       AND role.role::TEXT = 'SCHOOL_ADMIN'
       AND role.deleted_at IS NULL
      WHERE membership.school_id = $1
        AND membership.user_id = $2
        AND membership.membership_status = 'ACTIVE'
        AND membership.deleted_at IS NULL
      LIMIT 1
      `,
      [staff.school_id, staff.user_id],
    );
    if (!roleResult.rowCount) return;

    const adminResult = await client.query<{ count: string }>(
      `
      SELECT COUNT(DISTINCT membership.user_id)::TEXT AS count
      FROM school_memberships membership
      JOIN school_membership_roles role
        ON role.school_membership_id = membership.id
       AND role.role::TEXT = 'SCHOOL_ADMIN'
       AND role.deleted_at IS NULL
      JOIN school_staff_accounts staff
        ON staff.school_id = membership.school_id
       AND staff.user_id = membership.user_id
       AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
       AND staff.deleted_at IS NULL
      WHERE membership.school_id = $1
        AND membership.membership_status = 'ACTIVE'
        AND membership.deleted_at IS NULL
      `,
      [staff.school_id],
    );
    if (Number(adminResult.rows[0]?.count ?? 0) <= 1) {
      throw new BadRequestException(
        'The final active School Administrator cannot be suspended or terminated.',
      );
    }
  }

  private async invalidateLinkedUserTx(
    client: PoolClient,
    userId: string,
    reason: string,
  ) {
    await client.query(
      `
      UPDATE users
      SET
        authentication_version = authentication_version + 1,
        updated_at = NOW()
      WHERE id = $1
      `,
      [userId],
    );
    const sessionResult = await client.query(
      `
      UPDATE auth_sessions
      SET
        revoked_at = COALESCE(revoked_at, NOW()),
        revocation_reason = COALESCE(revocation_reason, $2)
      WHERE user_id = $1
        AND revoked_at IS NULL
      `,
      [userId, reason],
    );
    return sessionResult.rowCount ?? 0;
  }

  private async transitionStaff(
    staffId: string,
    dto: StaffLifecycleActionDto | RehireStaffDto,
    actorUserId: string,
    targetStatus: EmploymentStatus,
    allowedCurrentStatuses: EmploymentStatus[],
    operation: string,
  ) {
    try {
      return await this.db.withTransaction(async (client) => {
        await this.assertSchoolAdministrator(client, dto.schoolId, actorUserId);
        const staff = await this.lockStaff(client, dto.schoolId, staffId);
        this.assertVersion(staff, dto.rowVersion);
        if (!allowedCurrentStatuses.includes(staff.employment_status)) {
          throw new BadRequestException(
            `Staff cannot be ${operation} from ${staff.employment_status}.`,
          );
        }
        const reason = dto.reason.trim();
        if (!reason) {
          throw new BadRequestException(
            'A reason is required for lifecycle changes.',
          );
        }
        this.validateEffectiveDate(
          dto.effectiveDate,
          staff.status_effective_date,
        );
        await this.assertLifecycleSafety(
          client,
          staff,
          actorUserId,
          targetStatus,
        );

        const rehire =
          operation === 'rehired' ? (dto as RehireStaffDto) : undefined;
        if (rehire?.supervisorStaffAccountId === staffId) {
          throw new BadRequestException(
            'A staff member cannot supervise themselves.',
          );
        }
        if (rehire?.supervisorStaffAccountId) {
          await this.assertSupervisor(
            client,
            dto.schoolId,
            rehire.supervisorStaffAccountId,
          );
        }

        let payrollProfilesDisabled = 0;
        let assignmentsChanged = 0;
        let sessionsRevoked = 0;
        if (['SUSPENDED', 'TERMINATED', 'ARCHIVED'].includes(targetStatus)) {
          const payrollResult = await client.query(
            `
            UPDATE payroll_staff_profiles
            SET
              payroll_active = FALSE,
              updated_at = NOW()
            WHERE school_id = $1
              AND school_staff_account_id = $2
              AND payroll_active = TRUE
              AND deleted_at IS NULL
            `,
            [dto.schoolId, staffId],
          );
          payrollProfilesDisabled = payrollResult.rowCount ?? 0;

          const assignmentStatus =
            targetStatus === 'SUSPENDED' ? 'SUSPENDED' : 'ARCHIVED';
          const assignmentResult = await client.query(
            `
            UPDATE teacher_academic_assignments
            SET
              assignment_status = $3,
              updated_at = NOW()
            WHERE school_id = $1
              AND teacher_staff_account_id = $2
              AND assignment_status = 'ACTIVE'
              AND deleted_at IS NULL
            `,
            [dto.schoolId, staffId, assignmentStatus],
          );
          assignmentsChanged = assignmentResult.rowCount ?? 0;
        }

        if (staff.user_id) {
          sessionsRevoked = await this.invalidateLinkedUserTx(
            client,
            staff.user_id,
            'STAFF_EMPLOYMENT_STATUS_CHANGED',
          );
        }

        const updateValues: unknown[] = [
          staffId,
          dto.schoolId,
          dto.rowVersion,
          targetStatus,
          dto.effectiveDate,
          reason,
          actorUserId,
        ];
        const rehireUpdates: string[] = [];
        const addRehire = (column: string, value: unknown) => {
          updateValues.push(value);
          rehireUpdates.push(`${column} = $${updateValues.length}`);
        };
        if (rehire) {
          if (rehire.employmentType)
            addRehire('employment_type', rehire.employmentType);
          if (this.hasOwn(rehire, 'jobTitle'))
            addRehire('job_title', this.trim(rehire.jobTitle));
          if (this.hasOwn(rehire, 'department'))
            addRehire('department', this.trim(rehire.department));
          if (this.hasOwn(rehire, 'workLocation'))
            addRehire('work_location', this.trim(rehire.workLocation));
          if (this.hasOwn(rehire, 'supervisorStaffAccountId'))
            addRehire(
              'supervisor_staff_account_id',
              rehire.supervisorStaffAccountId ?? null,
            );
        }

        const updateResult = await client.query<StaffRecord>(
          `
          UPDATE school_staff_accounts
          SET
            employment_status = $4,
            status_effective_date = $5,
            status_reason = $6,
            employment_status_changed_by_user_id = $7
            ${rehireUpdates.length ? `, ${rehireUpdates.join(', ')}` : ''}
          WHERE id = $1
            AND school_id = $2
            AND row_version = $3
            AND deleted_at IS NULL
          RETURNING *
          `,
          updateValues,
        );
        const updated = updateResult.rows[0];
        if (!updated) {
          throw new ConflictException(
            'This staff record was changed by another user. Refresh and try again.',
          );
        }

        await this.platformActivityService.recordTx(client, {
          eventType: 'SCHOOL_STAFF_STATUS_CHANGED',
          actorType: 'SCHOOL_STAFF',
          actorUserId,
          schoolId: dto.schoolId,
          summary: `School staff member ${operation}.`,
          payload: {
            staffAccountId: staffId,
            linkedUserId: staff.user_id,
            previousStatus: staff.employment_status,
            newStatus: targetStatus,
            effectiveDate: dto.effectiveDate,
            sessionsRevoked,
            payrollProfilesDisabled,
            assignmentsChanged,
          },
        });

        return {
          updated: true,
          staff: this.mapStaff(updated),
          effects: {
            sessionsRevoked,
            payrollProfilesDisabled,
            assignmentsChanged,
            accessReviewRequired:
              targetStatus === 'ACTIVE' &&
              ['SUSPENDED', 'TERMINATED'].includes(staff.employment_status),
          },
        };
      });
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  activate(staffId: string, dto: StaffLifecycleActionDto, actorUserId: string) {
    return this.transitionStaff(
      staffId,
      dto,
      actorUserId,
      'ACTIVE',
      ['DRAFT'],
      'activated',
    );
  }

  placeOnLeave(
    staffId: string,
    dto: StaffLifecycleActionDto,
    actorUserId: string,
  ) {
    return this.transitionStaff(
      staffId,
      dto,
      actorUserId,
      'ON_LEAVE',
      ['ACTIVE'],
      'placed on leave',
    );
  }

  suspend(staffId: string, dto: StaffLifecycleActionDto, actorUserId: string) {
    return this.transitionStaff(
      staffId,
      dto,
      actorUserId,
      'SUSPENDED',
      ['ACTIVE', 'ON_LEAVE'],
      'suspended',
    );
  }

  reactivate(
    staffId: string,
    dto: StaffLifecycleActionDto,
    actorUserId: string,
  ) {
    return this.transitionStaff(
      staffId,
      dto,
      actorUserId,
      'ACTIVE',
      ['ON_LEAVE', 'SUSPENDED'],
      'reactivated',
    );
  }

  terminate(
    staffId: string,
    dto: StaffLifecycleActionDto,
    actorUserId: string,
  ) {
    return this.transitionStaff(
      staffId,
      dto,
      actorUserId,
      'TERMINATED',
      ['ACTIVE', 'ON_LEAVE', 'SUSPENDED'],
      'terminated',
    );
  }

  rehire(staffId: string, dto: RehireStaffDto, actorUserId: string) {
    return this.transitionStaff(
      staffId,
      dto,
      actorUserId,
      'ACTIVE',
      ['TERMINATED'],
      'rehired',
    );
  }

  archive(staffId: string, dto: StaffLifecycleActionDto, actorUserId: string) {
    return this.transitionStaff(
      staffId,
      dto,
      actorUserId,
      'ARCHIVED',
      ['DRAFT', 'TERMINATED'],
      'archived',
    );
  }

  async getHistory(staffId: string, schoolId: string, actorUserId: string) {
    await this.assertSchoolAdministrator(this.db, schoolId, actorUserId);
    const staff = await this.getStaff(staffId, schoolId, actorUserId);
    const [statuses, periods, positions] = await Promise.all([
      this.db.query<{
        id: string;
        previous_status: string | null;
        new_status: string;
        effective_date: string;
        reason: string;
        actor_user_id: string | null;
        created_at: string;
      }>(
        `
        SELECT
          id,
          previous_status,
          new_status,
          effective_date,
          reason,
          actor_user_id,
          created_at
        FROM staff_status_events
        WHERE school_id = $1
          AND staff_account_id = $2
        ORDER BY effective_date DESC, created_at DESC
        `,
        [schoolId, staffId],
      ),
      this.db.query(
        `
        SELECT
          id,
          start_date,
          end_date,
          employment_type,
          position_title,
          department,
          work_location,
          reason,
          created_by_user_id,
          created_at
        FROM staff_employment_periods
        WHERE school_id = $1
          AND staff_account_id = $2
          AND deleted_at IS NULL
        ORDER BY start_date DESC, created_at DESC
        `,
        [schoolId, staffId],
      ),
      this.db.query(
        `
        SELECT
          position.id,
          position.position_title,
          position.department,
          position.supervisor_staff_account_id,
          supervisor.first_name AS supervisor_first_name,
          supervisor.last_name AS supervisor_last_name,
          position.work_location,
          position.start_date,
          position.end_date,
          position.is_primary,
          position.change_reason,
          position.created_by_user_id,
          position.created_at
        FROM staff_position_assignments position
        LEFT JOIN school_staff_accounts supervisor
          ON supervisor.id = position.supervisor_staff_account_id
         AND supervisor.school_id = position.school_id
        WHERE position.school_id = $1
          AND position.staff_account_id = $2
          AND position.deleted_at IS NULL
        ORDER BY position.start_date DESC, position.created_at DESC
        `,
        [schoolId, staffId],
      ),
    ]);
    return {
      staff: {
        id: staff.id,
        staffCode: staff.staffCode,
        firstName: staff.firstName,
        lastName: staff.lastName,
      },
      statusEvents: statuses.rows.map((row) => ({
        id: row.id,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        effectiveDate: row.effective_date,
        reason: row.reason,
        actorUserId: row.actor_user_id,
        createdAt: row.created_at,
      })),
      employmentPeriods: periods.rows,
      positions: positions.rows,
    };
  }

  async getAccessSummary(
    staffId: string,
    schoolId: string,
    actorUserId: string,
  ) {
    await this.assertSchoolAdministrator(this.db, schoolId, actorUserId);
    const result = await this.db.query<{
      id: string;
      user_id: string | null;
      employment_status: EmploymentStatus;
      row_version: number;
      account_status: string | null;
      email_verified_at: string | null;
      last_login_at: string | null;
    }>(
      `
      SELECT
        staff.id,
        staff.user_id,
        staff.employment_status,
        staff.row_version,
        usr.account_status,
        usr.email_verified_at,
        usr.last_login_at
      FROM school_staff_accounts staff
      LEFT JOIN users usr
        ON usr.id = staff.user_id
       AND usr.deleted_at IS NULL
      WHERE staff.id = $1
        AND staff.school_id = $2
        AND staff.deleted_at IS NULL
      LIMIT 1
      `,
      [staffId, schoolId],
    );
    const staff = result.rows[0];
    if (!staff) throw new NotFoundException('Staff record not found.');
    if (!staff.user_id) {
      const pending = await this.db.query<{
        id: string;
        email_original: string;
        role_code: string;
        locale: string;
        expires_at: string;
        send_count: number;
        last_sent_at: string | null;
        failure_reason: string | null;
      }>(
        `
        SELECT
          id,
          email_original,
          role_code,
          locale,
          expires_at,
          send_count,
          last_sent_at,
          failure_reason
        FROM user_invitations
        WHERE school_id = $1
          AND staff_account_id = $2
          AND invitation_status = 'PENDING'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [schoolId, staffId],
      );
      const invitation = pending.rows[0];
      return {
        linked: false,
        employmentStatus: staff.employment_status,
        rowVersion: staff.row_version,
        account: null,
        roles: [],
        financePermissions: [],
        pendingInvitation: invitation
          ? {
              id: invitation.id,
              email: invitation.email_original,
              roleCode: invitation.role_code,
              locale: invitation.locale,
              expiresAt: invitation.expires_at,
              sendCount: invitation.send_count,
              lastSentAt: invitation.last_sent_at,
              deliveryFailed:
                invitation.failure_reason === 'EMAIL_DELIVERY_FAILED',
            }
          : null,
      };
    }
    const [roles, permissions, sessions] = await Promise.all([
      this.db.query<{ role_code: string }>(
        `
        SELECT role.role::TEXT AS role_code
        FROM school_memberships membership
        JOIN school_membership_roles role
          ON role.school_membership_id = membership.id
         AND role.deleted_at IS NULL
        WHERE membership.school_id = $1
          AND membership.user_id = $2
          AND membership.membership_status = 'ACTIVE'
          AND membership.deleted_at IS NULL
        ORDER BY role.role::TEXT
        `,
        [schoolId, staff.user_id],
      ),
      this.db.query<{ permission_code: string }>(
        `
        SELECT permission_code
        FROM school_user_permissions
        WHERE school_id = $1
          AND user_id = $2
          AND deleted_at IS NULL
        ORDER BY permission_code
        `,
        [schoolId, staff.user_id],
      ),
      this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::TEXT AS count
        FROM auth_sessions
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND expires_at > NOW()
        `,
        [staff.user_id],
      ),
    ]);
    return {
      linked: true,
      employmentStatus: staff.employment_status,
      rowVersion: staff.row_version,
      accessEnabled: ['ACTIVE', 'ON_LEAVE'].includes(staff.employment_status),
      account: {
        userId: staff.user_id,
        status: staff.account_status,
        emailVerifiedAt: staff.email_verified_at,
        lastLoginAt: staff.last_login_at,
        activeSessionCount: Number(sessions.rows[0]?.count ?? 0),
      },
      roles: roles.rows.map((row) => row.role_code),
      financePermissions: permissions.rows.map((row) => row.permission_code),
    };
  }

  async createStaffInvitation(
    staffId: string,
    dto: CreateStaffAccountInvitationDto,
    actorUserId: string,
  ) {
    await this.assertSchoolAdministrator(this.db, dto.schoolId, actorUserId);
    const result = await this.db.query<StaffRecord>(
      `
      SELECT *
      FROM school_staff_accounts
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [staffId, dto.schoolId],
    );
    const staff = result.rows[0];
    if (!staff) {
      throw new NotFoundException('Staff record not found.');
    }
    if (staff.user_id) {
      throw new ConflictException(
        'This staff record already has a linked account.',
      );
    }
    if (!['ACTIVE', 'ON_LEAVE'].includes(staff.employment_status)) {
      throw new BadRequestException(
        'Only active or on-leave staff can receive an account invitation.',
      );
    }
    if (!staff.email_original || !staff.email_normalized) {
      throw new BadRequestException(
        'Add a valid email address to the staff record before inviting access.',
      );
    }
    this.assertRoleMatchesStaff(staff, dto.roleCode);

    return this.invitationsService.createInvitation(
      {
        schoolId: dto.schoolId,
        staffAccountId: staffId,
        email: staff.email_original,
        firstName: staff.first_name ?? undefined,
        lastName: staff.last_name ?? undefined,
        roleCode: dto.roleCode,
        locale: dto.locale,
        staffCode: staff.staff_code ?? undefined,
        jobTitle: staff.job_title ?? undefined,
        department: staff.department ?? undefined,
        financePermissionCodes:
          dto.roleCode === 'FINANCE_ADMIN'
            ? dto.financePermissionCodes
            : undefined,
      },
      actorUserId,
      null,
    );
  }

  async linkStaffUser(
    staffId: string,
    dto: LinkStaffUserDto,
    actorUserId: string,
  ) {
    return this.db.withTransaction(async (client) => {
      await this.assertSchoolAdministrator(client, dto.schoolId, actorUserId);
      const staff = await this.lockStaff(client, dto.schoolId, staffId);
      this.assertVersion(staff, dto.rowVersion);
      if (staff.user_id) {
        throw new ConflictException(
          'This staff record already has a linked account.',
        );
      }
      if (!['ACTIVE', 'ON_LEAVE'].includes(staff.employment_status)) {
        throw new BadRequestException(
          'Only active or on-leave staff can receive account access.',
        );
      }
      if (!staff.email_normalized) {
        throw new BadRequestException(
          'Add a valid email address to the staff record before linking access.',
        );
      }
      this.assertRoleMatchesStaff(staff, dto.roleCode);
      const reason = dto.reason.trim();
      if (!reason) {
        throw new BadRequestException(
          'A reason is required to link a staff account.',
        );
      }

      const userResult = await client.query<{
        id: string;
        email_normalized: string | null;
        account_status: string;
      }>(
        `
        SELECT id, email_normalized, account_status
        FROM users
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [dto.userId],
      );
      const user = userResult.rows[0];
      if (!user || user.account_status !== 'ACTIVE') {
        throw new BadRequestException(
          'The selected user account is unavailable or inactive.',
        );
      }
      if (user.email_normalized !== staff.email_normalized) {
        throw new BadRequestException(
          'The user account email must match the staff record email.',
        );
      }

      const membership = await client.query(
        `
        SELECT membership.id
        FROM school_memberships membership
        JOIN school_membership_roles role
          ON role.school_membership_id = membership.id
         AND role.role::TEXT = $3
         AND role.deleted_at IS NULL
        WHERE membership.school_id = $1
          AND membership.user_id = $2
          AND membership.membership_status = 'ACTIVE'
          AND membership.deleted_at IS NULL
        LIMIT 1
        `,
        [dto.schoolId, dto.userId, dto.roleCode],
      );
      if (!membership.rowCount) {
        throw new BadRequestException(
          'The selected user does not have the required active school role.',
        );
      }

      const duplicate = await client.query(
        `
        SELECT id
        FROM school_staff_accounts
        WHERE school_id = $1
          AND user_id = $2
          AND id <> $3
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.schoolId, dto.userId, staffId],
      );
      if (duplicate.rowCount) {
        throw new ConflictException(
          'This user is already linked to another staff record in the school.',
        );
      }

      await client.query(
        `
        UPDATE user_invitations
        SET
          invitation_status = 'REVOKED',
          revoked_at = NOW(),
          updated_at = NOW()
        WHERE school_id = $1
          AND staff_account_id = $2
          AND invitation_status = 'PENDING'
        `,
        [dto.schoolId, staffId],
      );

      const updated = await client.query<{ row_version: number }>(
        `
        UPDATE school_staff_accounts
        SET
          user_id = $3,
          staff_type = $4,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND row_version = $5
          AND deleted_at IS NULL
        RETURNING row_version
        `,
        [staffId, dto.schoolId, dto.userId, dto.roleCode, dto.rowVersion],
      );
      if (!updated.rowCount) {
        throw new ConflictException(
          'This staff record was changed by another user. Refresh and try again.',
        );
      }

      if (dto.roleCode === 'TEACHER') {
        await client.query(
          `
          UPDATE teacher_academic_assignments
          SET teacher_user_id = $3, updated_at = NOW()
          WHERE school_id = $1
            AND teacher_staff_account_id = $2
          `,
          [dto.schoolId, staffId, dto.userId],
        );
      }

      await client.query(
        `
        INSERT INTO staff_account_user_link_events (
          school_id,
          staff_account_id,
          user_id,
          event_type,
          role_code,
          actor_user_id,
          reason
        )
        VALUES ($1, $2, $3, 'LINKED', $4, $5, $6)
        `,
        [dto.schoolId, staffId, dto.userId, dto.roleCode, actorUserId, reason],
      );
      const sessionsRevoked = await this.invalidateLinkedUserTx(
        client,
        dto.userId,
        'STAFF_ACCOUNT_LINK_CHANGED',
      );
      await this.platformActivityService.recordTx(client, {
        eventType: 'STAFF_ACCOUNT_LINKED',
        actorType: 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: 'A user account was linked to a staff record.',
        payload: {
          staffAccountId: staffId,
          affectedUserId: dto.userId,
          roleCode: dto.roleCode,
        },
      });
      return {
        linked: true,
        staffAccountId: staffId,
        userId: dto.userId,
        roleCode: dto.roleCode,
        rowVersion: updated.rows[0].row_version,
        sessionsRevoked,
        reauthenticationRequired: true,
      };
    });
  }

  async unlinkStaffUser(
    staffId: string,
    dto: UnlinkStaffUserDto,
    actorUserId: string,
  ) {
    return this.db.withTransaction(async (client) => {
      await this.assertSchoolAdministrator(client, dto.schoolId, actorUserId);
      const staff = await this.lockStaff(client, dto.schoolId, staffId);
      this.assertVersion(staff, dto.rowVersion);
      if (!staff.user_id) {
        throw new BadRequestException(
          'This staff record does not have a linked account.',
        );
      }
      const reason = dto.reason.trim();
      if (!reason) {
        throw new BadRequestException(
          'A reason is required to unlink a staff account.',
        );
      }

      let roleCode = staff.staff_type;
      if (!roleCode) {
        const roleResult = await client.query<{
          role_code: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';
        }>(
          `
          SELECT role.role::TEXT AS role_code
          FROM school_memberships membership
          JOIN school_membership_roles role
            ON role.school_membership_id = membership.id
           AND role.role::TEXT IN (
             'SCHOOL_ADMIN',
             'TEACHER',
             'FINANCE_ADMIN'
           )
           AND role.deleted_at IS NULL
          WHERE membership.school_id = $1
            AND membership.user_id = $2
            AND membership.membership_status = 'ACTIVE'
            AND membership.deleted_at IS NULL
          ORDER BY role.role::TEXT
          `,
          [dto.schoolId, staff.user_id],
        );
        if (roleResult.rows.length !== 1) {
          throw new BadRequestException(
            'The linked staff role is ambiguous and must be reconciled before unlinking.',
          );
        }
        roleCode = roleResult.rows[0].role_code;
      }

      await this.assertLifecycleSafety(client, staff, actorUserId, 'ARCHIVED');

      const activeAssignments = await client.query(
        `
        SELECT id
        FROM teacher_academic_assignments
        WHERE school_id = $1
          AND teacher_staff_account_id = $2
          AND assignment_status = 'ACTIVE'
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.schoolId, staffId],
      );
      if (activeAssignments.rowCount) {
        throw new BadRequestException(
          'Archive or reassign active teaching assignments before unlinking this account.',
        );
      }

      const activePayroll = await client.query(
        `
        SELECT id
        FROM payroll_staff_profiles
        WHERE school_id = $1
          AND school_staff_account_id = $2
          AND payroll_active = TRUE
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.schoolId, staffId],
      );
      if (activePayroll.rowCount) {
        throw new BadRequestException(
          'Disable the active payroll profile before unlinking this account.',
        );
      }

      await client.query(
        `
        UPDATE school_membership_roles role
        SET
          deleted_at = NOW(),
          updated_at = NOW()
        FROM school_memberships membership
        WHERE role.school_membership_id = membership.id
          AND membership.school_id = $1
          AND membership.user_id = $2
          AND membership.deleted_at IS NULL
          AND role.role::TEXT = $3
          AND role.deleted_at IS NULL
        `,
        [dto.schoolId, staff.user_id, roleCode],
      );
      await client.query(
        `
        UPDATE school_user_roles
        SET
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE school_id = $1
          AND user_id = $2
          AND role::TEXT = $3
          AND deleted_at IS NULL
        `,
        [dto.schoolId, staff.user_id, roleCode],
      );
      if (roleCode === 'FINANCE_ADMIN') {
        await client.query(
          `
          UPDATE school_user_permissions
          SET
            deleted_at = NOW(),
            updated_at = NOW()
          WHERE school_id = $1
            AND user_id = $2
            AND deleted_at IS NULL
          `,
          [dto.schoolId, staff.user_id],
        );
      }

      await client.query(
        `
        UPDATE school_memberships membership
        SET
          membership_status = 'SUSPENDED',
          suspended_at = NOW(),
          updated_at = NOW()
        WHERE membership.school_id = $1
          AND membership.user_id = $2
          AND membership.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM school_membership_roles role
            WHERE role.school_membership_id = membership.id
              AND role.deleted_at IS NULL
          )
        `,
        [dto.schoolId, staff.user_id],
      );

      const updated = await client.query<{ row_version: number }>(
        `
        UPDATE school_staff_accounts
        SET
          user_id = NULL,
          staff_type = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND row_version = $3
          AND deleted_at IS NULL
        RETURNING row_version
        `,
        [staffId, dto.schoolId, dto.rowVersion],
      );
      if (!updated.rowCount) {
        throw new ConflictException(
          'This staff record was changed by another user. Refresh and try again.',
        );
      }

      await client.query(
        `
        INSERT INTO staff_account_user_link_events (
          school_id,
          staff_account_id,
          user_id,
          event_type,
          role_code,
          actor_user_id,
          reason
        )
        VALUES ($1, $2, $3, 'UNLINKED', $4, $5, $6)
        `,
        [dto.schoolId, staffId, staff.user_id, roleCode, actorUserId, reason],
      );

      const sessionsRevoked = await this.invalidateLinkedUserTx(
        client,
        staff.user_id,
        'STAFF_ACCOUNT_UNLINKED',
      );
      const remainingSessions = await client.query<{ count: string }>(
        `
        SELECT COUNT(*)::TEXT AS count
        FROM auth_sessions
        WHERE user_id = $1
          AND revoked_at IS NULL
        `,
        [staff.user_id],
      );
      if (Number(remainingSessions.rows[0]?.count ?? 0) !== 0) {
        throw new ConflictException(
          'The linked account still has active sessions and cannot be unlinked safely.',
        );
      }

      /*
       * Historical actor and record-owner references remain attached to the
       * user. Only current school access is removed.
       */
      await this.platformActivityService.recordTx(client, {
        eventType: 'STAFF_ACCOUNT_UNLINKED',
        actorType: 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: 'A user account was unlinked from a staff record.',
        payload: {
          staffAccountId: staffId,
          affectedUserId: staff.user_id,
          roleCode,
        },
      });
      return {
        linked: false,
        staffAccountId: staffId,
        formerUserId: staff.user_id,
        roleCode,
        rowVersion: updated.rows[0].row_version,
        sessionsRevoked,
      };
    });
  }

  async getAssignments(staffId: string, schoolId: string, actorUserId: string) {
    await this.assertSchoolAdministrator(this.db, schoolId, actorUserId);
    const staffResult = await this.db.query(
      `
      SELECT id
      FROM school_staff_accounts
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [staffId, schoolId],
    );
    if (!staffResult.rowCount)
      throw new NotFoundException('Staff record not found.');

    const result = await this.db.query(
      `
      SELECT
        assignment.id,
        assignment.academic_year_id,
        year.name_i18n AS academic_year_name,
        assignment.section_id,
        section.code AS section_code,
        section.name_i18n AS section_name,
        assignment.subject_id,
        subject.code AS subject_code,
        subject.name_i18n AS subject_name,
        assignment.assignment_status,
        assignment.created_at,
        assignment.updated_at
      FROM teacher_academic_assignments assignment
      JOIN academic_years year
        ON year.id = assignment.academic_year_id
       AND year.school_id = assignment.school_id
       AND year.deleted_at IS NULL
      JOIN sections section
        ON section.id = assignment.section_id
       AND section.school_id = assignment.school_id
       AND section.deleted_at IS NULL
      JOIN school_subjects subject
        ON subject.id = assignment.subject_id
       AND subject.school_id = assignment.school_id
       AND subject.deleted_at IS NULL
      WHERE assignment.school_id = $1
        AND assignment.teacher_staff_account_id = $2
        AND assignment.deleted_at IS NULL
      ORDER BY year.start_date DESC, section.code, subject.code
      `,
      [schoolId, staffId],
    );
    return { items: result.rows };
  }

  async getPayrollSummary(
    staffId: string,
    schoolId: string,
    actorUserId: string,
  ) {
    await this.assertSchoolAdministrator(this.db, schoolId, actorUserId);
    const staffResult = await this.db.query(
      `
      SELECT id
      FROM school_staff_accounts
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [staffId, schoolId],
    );
    if (!staffResult.rowCount) {
      throw new NotFoundException('Staff record not found.');
    }
    const profileResult = await this.db.query<{
      id: string;
      job_title: string | null;
      base_salary: string;
      currency_code: string;
      payroll_active: boolean;
      salary_effective_from: string | null;
      updated_at: string;
      run_count: string;
      latest_run_at: string | null;
    }>(
      `
      SELECT
        profile.id,
        profile.job_title,
        profile.base_salary::TEXT,
        profile.currency_code,
        profile.payroll_active,
        profile.salary_effective_from,
        profile.updated_at,
        COUNT(item.id)::TEXT AS run_count,
        MAX(run.created_at) AS latest_run_at
      FROM payroll_staff_profiles profile
      LEFT JOIN payroll_run_items item
        ON item.payroll_staff_profile_id = profile.id
       AND item.school_id = profile.school_id
       AND item.deleted_at IS NULL
      LEFT JOIN payroll_runs run
        ON run.id = item.payroll_run_id
       AND run.school_id = item.school_id
       AND run.deleted_at IS NULL
      WHERE profile.school_id = $1
        AND profile.school_staff_account_id = $2
        AND profile.deleted_at IS NULL
      GROUP BY profile.id
      LIMIT 1
      `,
      [schoolId, staffId],
    );
    const profile = profileResult.rows[0];
    return {
      hasProfile: Boolean(profile),
      profile: profile
        ? {
            id: profile.id,
            jobTitle: profile.job_title,
            baseSalary: Number(profile.base_salary),
            currencyCode: profile.currency_code,
            active: profile.payroll_active,
            salaryEffectiveFrom: profile.salary_effective_from,
            payrollRunCount: Number(profile.run_count),
            latestRunAt: profile.latest_run_at,
            updatedAt: profile.updated_at,
          }
        : null,
    };
  }

  async getStaffMedical(
    staffId: string,
    schoolId: string,
    actorUserId: string,
  ) {
    await this.assertSchoolAdministrator(this.db, schoolId, actorUserId);
    const staff = await this.db.query(
      `
      SELECT id
      FROM school_staff_accounts
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [staffId, schoolId],
    );
    if (!staff.rowCount) throw new NotFoundException('Staff record not found.');

    const result = await this.db.query<StaffMedicalRecord>(
      `
      SELECT
        emergency_contact_name,
        emergency_contact_relationship,
        emergency_contact_phone,
        allergies_or_conditions,
        accommodation_notes,
        row_version,
        updated_at
      FROM staff_medical_information
      WHERE school_id = $1
        AND staff_account_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId, staffId],
    );
    const row = result.rows[0];
    return {
      emergencyContactName: row?.emergency_contact_name ?? null,
      emergencyContactRelationship: row?.emergency_contact_relationship ?? null,
      emergencyContactPhone: row?.emergency_contact_phone ?? null,
      allergiesOrConditions: row?.allergies_or_conditions ?? null,
      accommodationNotes: row?.accommodation_notes ?? null,
      rowVersion: row?.row_version ?? 0,
      updatedAt: row?.updated_at ?? null,
    };
  }

  async updateStaffMedical(
    staffId: string,
    dto: UpdateStaffMedicalDto,
    actorUserId: string,
  ) {
    const fields = [
      ['emergencyContactName', 'emergency_contact_name'],
      ['emergencyContactRelationship', 'emergency_contact_relationship'],
      ['emergencyContactPhone', 'emergency_contact_phone'],
      ['allergiesOrConditions', 'allergies_or_conditions'],
      ['accommodationNotes', 'accommodation_notes'],
    ] as const;
    const supplied = fields.filter(([property]) => this.hasOwn(dto, property));
    if (!supplied.length) {
      throw new BadRequestException('No medical information was supplied.');
    }

    return this.db.withTransaction(async (client) => {
      await this.assertSchoolAdministrator(client, dto.schoolId, actorUserId);
      const staff = await client.query<{ employment_status: EmploymentStatus }>(
        `
        SELECT employment_status
        FROM school_staff_accounts
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [staffId, dto.schoolId],
      );
      if (!staff.rows[0])
        throw new NotFoundException('Staff record not found.');
      if (staff.rows[0].employment_status === 'ARCHIVED') {
        throw new BadRequestException(
          'Archived staff medical information is read-only.',
        );
      }

      const existing = await client.query<{ id: string; row_version: number }>(
        `
        SELECT id, row_version
        FROM staff_medical_information
        WHERE school_id = $1
          AND staff_account_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [dto.schoolId, staffId],
      );

      let row: StaffMedicalRecord;
      if (existing.rows[0]) {
        if (existing.rows[0].row_version !== dto.rowVersion) {
          throw new ConflictException(
            'This medical record was changed by another user. Refresh and try again.',
          );
        }
        const values: unknown[] = [
          existing.rows[0].id,
          dto.schoolId,
          dto.rowVersion,
        ];
        const assignments = supplied.map(([property, column]) => {
          values.push(this.trim(dto[property]));
          return `${column} = $${values.length}`;
        });
        values.push(actorUserId);
        const updated = await client.query<StaffMedicalRecord>(
          `
          UPDATE staff_medical_information
          SET
            ${assignments.join(', ')},
            updated_by_user_id = $${values.length}
          WHERE id = $1
            AND school_id = $2
            AND row_version = $3
            AND deleted_at IS NULL
          RETURNING *
          `,
          values,
        );
        if (!updated.rows[0]) {
          throw new ConflictException(
            'This medical record was changed by another user. Refresh and try again.',
          );
        }
        row = updated.rows[0];
      } else {
        if (dto.rowVersion !== 0) {
          throw new ConflictException(
            'This medical record was changed by another user. Refresh and try again.',
          );
        }
        const created = await client.query<StaffMedicalRecord>(
          `
          INSERT INTO staff_medical_information (
            school_id,
            staff_account_id,
            emergency_contact_name,
            emergency_contact_relationship,
            emergency_contact_phone,
            allergies_or_conditions,
            accommodation_notes,
            created_by_user_id,
            updated_by_user_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
          RETURNING *
          `,
          [
            dto.schoolId,
            staffId,
            this.trim(dto.emergencyContactName),
            this.trim(dto.emergencyContactRelationship),
            this.trim(dto.emergencyContactPhone),
            this.trim(dto.allergiesOrConditions),
            this.trim(dto.accommodationNotes),
            actorUserId,
          ],
        );
        row = created.rows[0];
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'STAFF_MEDICAL_INFORMATION_UPDATED',
        actorType: 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: 'Restricted staff medical information updated.',
        payload: {
          staffAccountId: staffId,
          updatedFields: supplied.map(([property]) => property),
        },
      });
      return {
        emergencyContactName: row.emergency_contact_name,
        emergencyContactRelationship: row.emergency_contact_relationship,
        emergencyContactPhone: row.emergency_contact_phone,
        allergiesOrConditions: row.allergies_or_conditions,
        accommodationNotes: row.accommodation_notes,
        rowVersion: row.row_version,
        updatedAt: row.updated_at,
      };
    });
  }

  async getAssignmentOptions(
    staffId: string,
    schoolId: string,
    actorUserId: string,
  ) {
    await this.assertSchoolAdministrator(this.db, schoolId, actorUserId);
    const staff = await this.db.query<{
      user_id: string | null;
      staff_category: string;
      employment_status: string;
    }>(
      `
      SELECT
        user_id,
        staff_category,
        employment_status
      FROM school_staff_accounts
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [staffId, schoolId],
    );
    if (!staff.rows[0]) throw new NotFoundException('Staff record not found.');

    const [years, sections] = await Promise.all([
      this.db.query<{
        id: string;
        name_i18n: Record<string, string>;
        status: string;
        start_date: string;
        end_date: string;
      }>(
        `
        SELECT id, name_i18n, status, start_date, end_date
        FROM academic_years
        WHERE school_id = $1
          AND deleted_at IS NULL
        ORDER BY
          CASE status WHEN 'ACTIVE' THEN 1 WHEN 'PLANNED' THEN 2 ELSE 3 END,
          start_date DESC
        `,
        [schoolId],
      ),
      this.db.query<{
        id: string;
        academic_year_id: string;
        code: string;
        name_i18n: Record<string, string>;
        grade_level_code: string;
        grade_level_name_i18n: Record<string, string>;
        subject_id: string;
        subject_code: string;
        subject_name_i18n: Record<string, string>;
      }>(
        `
        SELECT
          section.id,
          section.academic_year_id,
          section.code,
          section.name_i18n,
          grade.code AS grade_level_code,
          grade.name_i18n AS grade_level_name_i18n,
          subject.id AS subject_id,
          subject.code AS subject_code,
          subject.name_i18n AS subject_name_i18n
        FROM sections section
        JOIN grade_levels grade
          ON grade.id = section.grade_level_id
         AND grade.school_id = section.school_id
         AND grade.deleted_at IS NULL
        JOIN grade_level_subjects configured
          ON configured.school_id = section.school_id
         AND configured.grade_level_id = section.grade_level_id
         AND configured.deleted_at IS NULL
        JOIN school_subjects subject
          ON subject.id = configured.subject_id
         AND subject.school_id = section.school_id
         AND subject.subject_active = TRUE
         AND subject.deleted_at IS NULL
        WHERE section.school_id = $1
          AND section.deleted_at IS NULL
        ORDER BY
          section.academic_year_id,
          grade.display_order,
          section.code,
          configured.display_order,
          subject.code
        `,
        [schoolId],
      ),
    ]);

    const sectionMap = new Map<
      string,
      {
        id: string;
        academicYearId: string;
        code: string;
        nameI18n: Record<string, string>;
        gradeLevelCode: string;
        gradeLevelNameI18n: Record<string, string>;
        subjects: Array<{
          id: string;
          code: string;
          nameI18n: Record<string, string>;
        }>;
      }
    >();
    for (const row of sections.rows) {
      if (!sectionMap.has(row.id)) {
        sectionMap.set(row.id, {
          id: row.id,
          academicYearId: row.academic_year_id,
          code: row.code,
          nameI18n: row.name_i18n,
          gradeLevelCode: row.grade_level_code,
          gradeLevelNameI18n: row.grade_level_name_i18n,
          subjects: [],
        });
      }
      sectionMap.get(row.id)!.subjects.push({
        id: row.subject_id,
        code: row.subject_code,
        nameI18n: row.subject_name_i18n,
      });
    }

    return {
      staffAccountId: staffId,
      userId: staff.rows[0].user_id,
      eligible:
        staff.rows[0].staff_category === 'TEACHING' &&
        staff.rows[0].employment_status === 'ACTIVE',
      loginAvailable: Boolean(staff.rows[0].user_id),
      academicYears: years.rows.map((year) => ({
        id: year.id,
        nameI18n: year.name_i18n,
        status: year.status,
        startDate: this.dateOnly(year.start_date),
        endDate: this.dateOnly(year.end_date),
      })),
      sections: Array.from(sectionMap.values()),
    };
  }
  async getOptions(schoolId: string, actorUserId: string) {
    await this.assertSchoolAdministrator(this.db, schoolId, actorUserId);
    const [departments, supervisors] = await Promise.all([
      this.db.query<{ department: string }>(
        `
        SELECT DISTINCT department
        FROM school_staff_accounts
        WHERE school_id = $1
          AND department IS NOT NULL
          AND deleted_at IS NULL
        ORDER BY department
        `,
        [schoolId],
      ),
      this.db.query<{
        id: string;
        staff_code: string | null;
        first_name: string | null;
        last_name: string | null;
        job_title: string | null;
      }>(
        `
        SELECT
          id,
          staff_code,
          first_name,
          last_name,
          job_title
        FROM school_staff_accounts
        WHERE school_id = $1
          AND employment_status IN ('ACTIVE', 'ON_LEAVE')
          AND deleted_at IS NULL
        ORDER BY last_name NULLS LAST, first_name NULLS LAST
        `,
        [schoolId],
      ),
    ]);
    return {
      staffCategories: [
        'SCHOOL_LEADERSHIP',
        'TEACHING',
        'FINANCE',
        'ADMINISTRATIVE',
        'STUDENT_SERVICES',
        'SUPPORT',
        'CONTRACTOR',
        'OTHER',
      ],
      employmentTypes: [
        'FULL_TIME',
        'PART_TIME',
        'CONTRACT',
        'TEMPORARY',
        'VOLUNTEER',
      ],
      employmentStatuses: [
        'DRAFT',
        'ACTIVE',
        'ON_LEAVE',
        'SUSPENDED',
        'TERMINATED',
        'ARCHIVED',
      ],
      departments: departments.rows.map((row) => row.department),
      supervisors: supervisors.rows.map((row) => ({
        id: row.id,
        staffCode: row.staff_code,
        firstName: row.first_name,
        lastName: row.last_name,
        jobTitle: row.job_title,
      })),
    };
  }
}
