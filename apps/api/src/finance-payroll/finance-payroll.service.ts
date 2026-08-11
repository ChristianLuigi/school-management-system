import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { CreatePayrollProfileDto } from '../finance-operations/dto/create-payroll-profile.dto';
import { CreatePayrollCompensationVersionDto } from './dto/create-payroll-compensation-version.dto';
import { CreatePayrollRunDto } from '../finance-operations/dto/create-payroll-run.dto';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { MarkPayrollItemPaidDto } from './dto/mark-payroll-item-paid.dto';
import { ReversePayrollItemPaymentDto } from './dto/reverse-payroll-item-payment.dto';
import {
  type PayrollAdjustmentLineDto,
  UpdatePayrollItemAdjustmentsDto,
} from './dto/update-payroll-item-adjustments.dto';
import {
  type PayrollRunStatus,
  UpdatePayrollRunStatusDto,
} from './dto/update-payroll-run-status.dto';

type PlatformRole = 'SUPER_ADMIN' | null;
type ActorType = 'SUPERADMIN' | 'SCHOOL_STAFF';
type SchoolManagementMode =
  | 'SELF_MANAGED'
  | 'SUPERADMIN_MANAGED'
  | 'HYBRID_MANAGED';
type PayrollActorContext = {
  userId: string;
  managementMode: SchoolManagementMode;
  isPlatformSuperAdmin: boolean;
  isSchoolAdmin: boolean;
  isFinanceAdmin: boolean;
  roleCodes: string[];
  permissions: string[];
};

type PayrollRunRow = {
  id: string;
  payroll_number: string | null;
  period_label: string;
  period_start: string;
  period_end: string;
  payroll_status: PayrollRunStatus;
  currency_code: string;
  total_gross: string;
  total_allowances: string;
  total_deductions: string;
  total_net: string;
  notes: string | null;
  prepared_by_user_id: string;
  prepared_at: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  processed_by_user_id: string | null;
  processing_started_at: string | null;
  paid_at: string | null;
  closed_by_user_id: string | null;
  closed_at: string | null;
  separation_override_reason: string | null;
  run_version: number;
  content_checksum: string | null;
  submitted_for_review_by_user_id: string | null;
  submitted_for_review_at: string | null;
  pending_approval_at: string | null;
  created_at: string;
};

type PayrollItemRow = {
  id: string;
  payroll_staff_profile_id: string;
  staff_account_id: string;
  currency_code: string;
  gross_salary: string;
  allowances: string;
  deductions: string;
  net_salary: string;
  payment_status: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  snapshot_full_name: string;
  snapshot_staff_code: string | null;
  snapshot_position_title: string | null;
  snapshot_department: string | null;
  snapshot_employment_type: string;
  snapshot_pay_frequency: string;
  snapshot_base_salary: string;
};

type AdjustmentRow = {
  id: string;
  payroll_run_item_id: string;
  adjustment_type: 'ALLOWANCE' | 'DEDUCTION';
  adjustment_code: string;
  description: string;
  amount: string;
};

type ReversalRow = {
  id: string;
  payroll_run_item_id: string;
  original_paid_at: string;
  original_payment_method: string | null;
  original_payment_reference: string | null;
  reason: string;
  reversed_by_user_id: string;
  reversed_at: string;
};

const STATUS_TRANSITIONS: Partial<
  Record<PayrollRunStatus, PayrollRunStatus[]>
> = {
  DRAFT: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['DRAFT', 'PENDING_APPROVAL'],
  PENDING_APPROVAL: ['DRAFT', 'APPROVED'],
  // REVIEWED is a legacy source state only. New runs never enter it.
  REVIEWED: ['DRAFT', 'PENDING_APPROVAL'],
  APPROVED: ['DRAFT', 'PROCESSING'],
  PROCESSING: ['PAID'],
  PAID: ['CLOSED'],
  CLOSED: [],
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class FinancePayrollService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  private actorType(platformRole: PlatformRole): ActorType {
    return platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF';
  }

  private currency(value: string) {
    const normalized = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new BadRequestException(
        'Currency code must contain three letters.',
      );
    }
    return normalized;
  }

  private standardCompensationLines(
    values: Array<{ code: string; description: string; amount: number }>,
    label: string,
  ) {
    if (values.length > 50) {
      throw new BadRequestException(`${label} cannot contain more than 50 lines.`);
    }
    const codes = new Set<string>();
    return values.map((value) => {
      const code = value.code.trim().toUpperCase();
      const description = value.description.trim();
      const amount = money(Number(value.amount));
      if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code)) {
        throw new BadRequestException(`Invalid ${label.toLowerCase()} code.`);
      }
      if (!description) {
        throw new BadRequestException(`${label} description is required.`);
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException(`${label} amount must be greater than zero.`);
      }
      if (codes.has(code)) {
        throw new BadRequestException(`Duplicate ${label.toLowerCase()} code: ${code}.`);
      }
      codes.add(code);
      return { code, description, amount };
    });
  }

  private async getPayrollActorContext(
    actorUserId: string,
    schoolId: string,
    platformRole: PlatformRole,
  ): Promise<PayrollActorContext> {
    const schoolResult = await this.db.query<{
      id: string;
      management_mode: SchoolManagementMode;
    }>(
      `
      SELECT id, management_mode
      FROM schools
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId],
    );
    const school = schoolResult.rows[0];
    if (!school) throw new NotFoundException('School not found.');

    const [membershipResult, permissionsResult] = await Promise.all([
      this.db.query<{ role: string }>(
        `
        SELECT smr.role::text AS role
        FROM school_memberships sm
        JOIN school_membership_roles smr
          ON smr.school_membership_id = sm.id
         AND smr.deleted_at IS NULL
        WHERE sm.user_id = $1
          AND sm.school_id = $2
          AND sm.deleted_at IS NULL
          AND sm.membership_status = 'ACTIVE'
          AND (
            smr.role::TEXT NOT IN (
              'SCHOOL_ADMIN',
              'TEACHER',
              'FINANCE_ADMIN'
            )
            OR EXISTS (
              SELECT 1
              FROM school_staff_accounts staff
              WHERE staff.school_id = sm.school_id
                AND staff.user_id = sm.user_id
                AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
                AND staff.deleted_at IS NULL
            )
          )
        `,
        [actorUserId, schoolId],
      ),
      this.db.query<{ permission_code: string }>(
        `
        SELECT permission_code
        FROM school_user_permissions
        WHERE user_id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        `,
        [actorUserId, schoolId],
      ),
    ]);
    const roleCodes = membershipResult.rows.map((row) => row.role);
    const permissions = permissionsResult.rows.map(
      (row) => row.permission_code,
    );
    const context: PayrollActorContext = {
      userId: actorUserId,
      managementMode: school.management_mode,
      isPlatformSuperAdmin: platformRole === 'SUPER_ADMIN',
      isSchoolAdmin: roleCodes.includes('SCHOOL_ADMIN'),
      isFinanceAdmin: roleCodes.includes('FINANCE_ADMIN'),
      roleCodes,
      permissions,
    };
    const hasPayrollAccess =
      context.isSchoolAdmin ||
      (context.isFinanceAdmin &&
        permissions.some(
          (permission) =>
            permission === 'PAYROLL_VIEW' ||
            permission === 'PAYROLL_MANAGE' ||
            permission.startsWith('PAYROLL_'),
        )) ||
      (context.isPlatformSuperAdmin &&
        context.managementMode !== 'SELF_MANAGED');
    if (!hasPayrollAccess) {
      throw new ForbiddenException(
        'You do not have permission to access payroll operations.',
      );
    }
    return context;
  }

  private async assertUserCanAccessFinance(
    actorUserId: string,
    schoolId: string,
    platformRole: PlatformRole,
  ) {
    return this.getPayrollActorContext(actorUserId, schoolId, platformRole);
  }

  private hasPayrollPermission(
    actor: PayrollActorContext,
    permissionCode: string,
  ) {
    return (
      actor.permissions.includes(permissionCode) ||
      actor.permissions.includes('PAYROLL_MANAGE')
    );
  }

  private assertCanPrepare(actor: PayrollActorContext) {
    if (
      actor.isSchoolAdmin ||
      (actor.isFinanceAdmin &&
        this.hasPayrollPermission(actor, 'PAYROLL_PREPARE'))
    ) {
      return;
    }
    throw new ForbiddenException('Payroll preparation permission is required.');
  }

  private assertCanReview(actor: PayrollActorContext) {
    if (
      actor.isSchoolAdmin ||
      (actor.isFinanceAdmin &&
        this.hasPayrollPermission(actor, 'PAYROLL_REVIEW'))
    ) {
      return;
    }
    throw new ForbiddenException('Payroll review permission is required.');
  }

  private assertCanProcess(actor: PayrollActorContext) {
    if (
      actor.isSchoolAdmin ||
      (actor.isFinanceAdmin &&
        this.hasPayrollPermission(actor, 'PAYROLL_PROCESS'))
    ) {
      return;
    }
    throw new ForbiddenException('Payroll processing permission is required.');
  }

  private assertCanReverse(actor: PayrollActorContext) {
    if (
      actor.isSchoolAdmin ||
      (actor.isFinanceAdmin &&
        this.hasPayrollPermission(actor, 'PAYROLL_REVERSE'))
    ) {
      return;
    }
    throw new ForbiddenException('Payroll reversal permission is required.');
  }

  private assertActiveSchoolAdmin(actor: PayrollActorContext) {
    if (!actor.isSchoolAdmin) {
      throw new ForbiddenException(
        'An active School Administrator is required for this payroll action.',
      );
    }
  }

  private mapActor(actor: PayrollActorContext) {
    return {
      userId: actor.userId,
      roleCodes: actor.roleCodes,
      permissions: actor.permissions,
      isSchoolAdmin: actor.isSchoolAdmin,
      isFinanceAdmin: actor.isFinanceAdmin,
    };
  }
  private mapProfile(row: {
    id: string;
    school_id: string;
    school_staff_account_id: string;
    user_id: string | null;
    full_name: string;
    staff_code: string | null;
    job_title: string | null;
    position_title: string | null;
    department: string | null;
    employment_type: string;
    pay_frequency: string;
    base_salary: string;
    currency_code: string;
    payroll_active: boolean;
    notes: string | null;
    effective_from: string | null;
    compensation_type: string;
    standard_allowances: unknown[];
    standard_deductions: unknown[];
    created_at: string;
  }) {
    return {
      id: row.id,
      schoolId: row.school_id,
      staffAccountId: row.school_staff_account_id,
      userId: row.user_id,
      fullName: row.full_name,
      staffCode: row.staff_code,
      jobTitle: row.job_title,
      positionTitle: row.position_title,
      department: row.department,
      employmentType: row.employment_type,
      payFrequency: row.pay_frequency,
      baseSalary: Number(row.base_salary),
      currencyCode: row.currency_code,
      payrollActive: row.payroll_active,
      notes: row.notes,
      effectiveFrom: row.effective_from,
      compensationType: row.compensation_type,
      standardAllowances: row.standard_allowances,
      standardDeductions: row.standard_deductions,
      createdAt: row.created_at,
    };
  }

  async listPayrollStaffOptions(
    query: { schoolId: string },
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      query.schoolId,
      platformRole,
    );
    const result = await this.db.query<{
      id: string;
      user_id: string | null;
      full_name: string;
      email_original: string | null;
      staff_code: string | null;
      job_title: string | null;
      department: string | null;
      staff_type: string | null;
      employment_status: string;
      payroll_profile_id: string | null;
    }>(
      `
      SELECT
        staff.id,
        staff.user_id,
        COALESCE(
          NULLIF(BTRIM(CONCAT_WS(
            ' ',
            COALESCE(staff.preferred_name, staff.first_name),
            staff.last_name
          )), ''),
          NULLIF(BTRIM(CONCAT_WS(' ', usr.first_name, usr.last_name)), ''),
          staff.email_original,
          usr.email_original,
          staff.staff_code,
          'Unnamed staff member'
        ) AS full_name,
        COALESCE(staff.email_original, usr.email_original) AS email_original,
        staff.staff_code,
        staff.job_title,
        staff.department,
        staff.staff_type,
        staff.employment_status,
        profile.id AS payroll_profile_id
      FROM school_staff_accounts staff
      LEFT JOIN users usr
        ON usr.id = staff.user_id
       AND usr.deleted_at IS NULL
      LEFT JOIN payroll_staff_profiles profile
        ON profile.school_staff_account_id = staff.id
       AND profile.school_id = staff.school_id
       AND profile.deleted_at IS NULL
      WHERE staff.school_id = $1
        AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
        AND staff.deleted_at IS NULL
      ORDER BY full_name ASC
      `,
      [query.schoolId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email_original,
      staffCode: row.staff_code,
      jobTitle: row.job_title,
      department: row.department,
      staffType: row.staff_type,
      employmentStatus: row.employment_status,
      payrollProfileId: row.payroll_profile_id,
      hasPayrollProfile: Boolean(row.payroll_profile_id),
    }));
  }

  async listPayrollProfiles(
    query: { schoolId: string },
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      query.schoolId,
      platformRole,
    );
    const result = await this.db.query<Parameters<FinancePayrollService['mapProfile']>[0]>(
      `
      SELECT
        profile.id,
        profile.school_id,
        profile.school_staff_account_id,
        staff.user_id,
        profile.full_name,
        profile.staff_code,
        profile.job_title,
        profile.position_title,
        profile.department,
        profile.employment_type,
        COALESCE(version.pay_frequency, profile.pay_frequency) AS pay_frequency,
        COALESCE(version.base_amount, profile.base_salary)::text AS base_salary,
        COALESCE(version.currency_code, profile.currency_code) AS currency_code,
        profile.payroll_active,
        profile.notes,
        COALESCE(version.effective_from, profile.salary_effective_from)::text AS effective_from,
        COALESCE(version.compensation_type, 'SALARY') AS compensation_type,
        COALESCE(version.standard_allowances, '[]'::jsonb) AS standard_allowances,
        COALESCE(version.standard_deductions, '[]'::jsonb) AS standard_deductions,
        profile.created_at::text AS created_at
      FROM payroll_staff_profiles profile
      JOIN school_staff_accounts staff
        ON staff.id = profile.school_staff_account_id
       AND staff.school_id = profile.school_id
       AND staff.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT compensation.*
        FROM payroll_compensation_versions compensation
        WHERE compensation.school_id = profile.school_id
          AND compensation.payroll_staff_profile_id = profile.id
          AND compensation.effective_from <= CURRENT_DATE
        ORDER BY compensation.effective_from DESC, compensation.created_at DESC
        LIMIT 1
      ) version ON TRUE
      WHERE profile.school_id = $1
        AND profile.deleted_at IS NULL
      ORDER BY profile.payroll_active DESC, profile.full_name ASC
      LIMIT 200
      `,
      [query.schoolId],
    );
    return result.rows.map((row) => this.mapProfile(row));
  }

  async createPayrollProfile(
    dto: CreatePayrollProfileDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actor = await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );
    this.assertActiveSchoolAdmin(actor);
    const baseSalary = money(Number(dto.baseSalary));
    if (!Number.isFinite(baseSalary) || baseSalary < 0) {
      throw new BadRequestException('Base salary must be zero or greater.');
    }
    const currencyCode = this.currency(dto.currencyCode);
    const effectiveFrom =
      dto.effectiveFrom ?? `${new Date().toISOString().slice(0, 7)}-01`;
    const payFrequency = dto.payFrequency ?? 'MONTHLY';
    const compensationType = dto.compensationType ?? 'SALARY';
    if (compensationType !== 'SALARY') {
      throw new BadRequestException(
        'Hourly and daily compensation require approved work-unit data and are not enabled yet.',
      );
    }
    const changeReason =
      dto.changeReason?.trim() || 'Initial payroll enrollment.';
    try {
      return await this.db.withTransaction(async (client) => {
        const staffResult = await client.query<{
          id: string;
          user_id: string | null;
          staff_code: string | null;
          staff_type: string | null;
          job_title: string | null;
          department: string | null;
          employment_type: string;
          full_name: string;
        }>(
          `
          SELECT
            staff.id,
            staff.user_id,
            staff.staff_code,
            staff.staff_type,
            staff.job_title,
            staff.department,
            staff.employment_type,
            COALESCE(
              NULLIF(BTRIM(CONCAT_WS(
                ' ',
                COALESCE(staff.preferred_name, staff.first_name),
                staff.last_name
              )), ''),
              NULLIF(BTRIM(CONCAT_WS(' ', usr.first_name, usr.last_name)), ''),
              staff.email_original,
              usr.email_original,
              staff.staff_code,
              'Unnamed staff member'
            ) AS full_name
          FROM school_staff_accounts staff
          LEFT JOIN users usr
            ON usr.id = staff.user_id
           AND usr.deleted_at IS NULL
          WHERE staff.id = $1
            AND staff.school_id = $2
            AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
            AND staff.deleted_at IS NULL
          LIMIT 1
          FOR UPDATE OF staff
          `,
          [dto.staffAccountId, dto.schoolId],
        );
        const staff = staffResult.rows[0];
        if (!staff) {
          throw new BadRequestException(
            'The selected active staff account does not belong to this school.',
          );
        }
        const result = await client.query<Parameters<FinancePayrollService['mapProfile']>[0]>(
          `
          INSERT INTO payroll_staff_profiles (
            school_id,
            school_staff_account_id,
            full_name,
            staff_code,
            job_title,
            position_title,
            department,
            employment_type,
            pay_frequency,
            base_salary,
            currency_code,
            payroll_active,
            notes,
            salary_effective_from,
            created_by_user_id
          )
          VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13::date,$14)
          RETURNING
            id,
            school_id,
            school_staff_account_id,
            $15::uuid AS user_id,
            full_name,
            staff_code,
            job_title,
            position_title,
            department,
            employment_type,
            pay_frequency,
            base_salary::text AS base_salary,
            currency_code,
            payroll_active,
            notes,
            salary_effective_from::text AS effective_from,
            $16::text AS compensation_type,
            '[]'::jsonb AS standard_allowances,
            '[]'::jsonb AS standard_deductions,
            created_at::text AS created_at
          `,
          [
            dto.schoolId,
            staff.id,
            staff.full_name,
            staff.staff_code,
            staff.job_title,
            staff.department,
            staff.employment_type,
            payFrequency,
            baseSalary,
            currencyCode,
            dto.payrollActive ?? true,
            dto.notes?.trim() || null,
            effectiveFrom,
            actorUserId,
            staff.user_id,
            compensationType,
          ],
        );
        const row = result.rows[0];
        await client.query(
          `
          INSERT INTO payroll_compensation_versions (
            school_id,
            payroll_staff_profile_id,
            staff_account_id,
            effective_from,
            compensation_type,
            base_amount,
            currency_code,
            pay_frequency,
            standard_allowances,
            standard_deductions,
            change_reason,
            approved_by_user_id,
            created_by_user_id
          )
          VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,'[]'::jsonb,'[]'::jsonb,$9,$10,$10)
          `,
          [
            dto.schoolId,
            row.id,
            staff.id,
            effectiveFrom,
            compensationType,
            baseSalary,
            currencyCode,
            payFrequency,
            changeReason,
            actorUserId,
          ],
        );
        await this.platformActivityService.recordTx(client, {
          eventType: 'PAYROLL_PROFILE_CREATED',
          actorType: this.actorType(platformRole),
          actorUserId,
          schoolId: dto.schoolId,
          summary: `Payroll profile created for ${staff.full_name}.`,
          payload: {
            payrollStaffProfileId: row.id,
            staffAccountId: staff.id,
            affectedUserId: staff.user_id,
            effectiveFrom,
            compensationType,
            payFrequency,
            currencyCode,
          },
        });
        return this.mapProfile(row);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'This staff account already has a payroll profile or compensation on that effective date.',
        );
      }
      throw error;
    }
  }

  async listPayrollCompensationVersions(
    profileId: string,
    schoolId: string,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    await this.assertUserCanAccessFinance(actorUserId, schoolId, platformRole);
    const result = await this.db.query<{
      id: string;
      effective_from: string;
      compensation_type: string;
      base_amount: string;
      currency_code: string;
      pay_frequency: string;
      standard_allowances: unknown[];
      standard_deductions: unknown[];
      change_reason: string;
      approved_by_user_id: string;
      created_at: string;
    }>(
      `
      SELECT
        id,
        effective_from::text AS effective_from,
        compensation_type,
        base_amount::text AS base_amount,
        currency_code,
        pay_frequency,
        standard_allowances,
        standard_deductions,
        change_reason,
        approved_by_user_id,
        created_at::text AS created_at
      FROM payroll_compensation_versions
      WHERE school_id = $1
        AND payroll_staff_profile_id = $2
      ORDER BY effective_from DESC, created_at DESC
      `,
      [schoolId, profileId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      effectiveFrom: row.effective_from,
      compensationType: row.compensation_type,
      baseAmount: Number(row.base_amount),
      currencyCode: row.currency_code,
      payFrequency: row.pay_frequency,
      standardAllowances: row.standard_allowances,
      standardDeductions: row.standard_deductions,
      changeReason: row.change_reason,
      approvedByUserId: row.approved_by_user_id,
      createdAt: row.created_at,
    }));
  }

  async createPayrollCompensationVersion(
    profileId: string,
    dto: CreatePayrollCompensationVersionDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actor = await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );
    this.assertActiveSchoolAdmin(actor);
    const baseAmount = money(Number(dto.baseAmount));
    if (!Number.isFinite(baseAmount) || baseAmount < 0) {
      throw new BadRequestException('Base amount must be zero or greater.');
    }
    const reason = dto.changeReason.trim();
    if (!reason) throw new BadRequestException('A compensation change reason is required.');
    const currencyCode = this.currency(dto.currencyCode);
    if (dto.compensationType !== 'SALARY') {
      throw new BadRequestException(
        'Hourly and daily compensation require approved work-unit data and are not enabled yet.',
      );
    }
    const standardAllowances = this.standardCompensationLines(
      dto.standardAllowances,
      'Allowance',
    );
    const standardDeductions = this.standardCompensationLines(
      dto.standardDeductions,
      'Deduction',
    );
    try {
      return await this.db.withTransaction(async (client) => {
        const profileResult = await client.query<{
          id: string;
          staff_account_id: string;
        }>(
          `
          SELECT profile.id, profile.school_staff_account_id AS staff_account_id
          FROM payroll_staff_profiles profile
          JOIN school_staff_accounts staff
            ON staff.id = profile.school_staff_account_id
           AND staff.school_id = profile.school_id
           AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
           AND staff.deleted_at IS NULL
          WHERE profile.id = $1
            AND profile.school_id = $2
            AND profile.deleted_at IS NULL
          LIMIT 1
          FOR UPDATE OF profile, staff
          `,
          [profileId, dto.schoolId],
        );
        const profile = profileResult.rows[0];
        if (!profile) throw new NotFoundException('Active payroll profile not found.');
        const created = await client.query<{
          id: string;
          created_at: string;
        }>(
          `
          INSERT INTO payroll_compensation_versions (
            school_id,
            payroll_staff_profile_id,
            staff_account_id,
            effective_from,
            compensation_type,
            base_amount,
            currency_code,
            pay_frequency,
            standard_allowances,
            standard_deductions,
            change_reason,
            approved_by_user_id,
            created_by_user_id
          )
          VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$12)
          RETURNING id, created_at::text AS created_at
          `,
          [
            dto.schoolId,
            profileId,
            profile.staff_account_id,
            dto.effectiveFrom,
            dto.compensationType,
            baseAmount,
            currencyCode,
            dto.payFrequency,
            JSON.stringify(standardAllowances),
            JSON.stringify(standardDeductions),
            reason,
            actorUserId,
          ],
        );
        await client.query(
          `
          UPDATE payroll_staff_profiles
          SET
            base_salary = $3,
            currency_code = $4,
            pay_frequency = $5,
            salary_effective_from = $6::date,
            updated_at = NOW()
          WHERE id = $1
            AND school_id = $2
            AND (
              salary_effective_from IS NULL
              OR salary_effective_from <= $6::date
            )
          `,
          [
            profileId,
            dto.schoolId,
            baseAmount,
            currencyCode,
            dto.payFrequency,
            dto.effectiveFrom,
          ],
        );
        await this.platformActivityService.recordTx(client, {
          eventType: 'PAYROLL_COMPENSATION_VERSION_CREATED',
          actorType: this.actorType(platformRole),
          actorUserId,
          schoolId: dto.schoolId,
          summary: 'An effective-dated payroll compensation version was created.',
          payload: {
            payrollStaffProfileId: profileId,
            staffAccountId: profile.staff_account_id,
            compensationVersionId: created.rows[0].id,
            effectiveFrom: dto.effectiveFrom,
            compensationType: dto.compensationType,
            payFrequency: dto.payFrequency,
            currencyCode,
          },
        });
        return {
          id: created.rows[0].id,
          profileId,
          staffAccountId: profile.staff_account_id,
          effectiveFrom: dto.effectiveFrom,
          compensationType: dto.compensationType,
          baseAmount,
          currencyCode,
          payFrequency: dto.payFrequency,
          standardAllowances,
          standardDeductions,
          changeReason: reason,
          approvedByUserId: actorUserId,
          createdAt: created.rows[0].created_at,
        };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'A compensation version already exists on that effective date.',
        );
      }
      throw error;
    }
  }
  private mapRun(row: PayrollRunRow) {
    return {
      id: row.id,
      payrollNumber: row.payroll_number,
      periodLabel: row.period_label,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      payrollStatus: row.payroll_status,
      currencyCode: row.currency_code,
      totalGross: Number(row.total_gross),
      totalAllowances: Number(row.total_allowances),
      totalDeductions: Number(row.total_deductions),
      totalNet: Number(row.total_net),
      notes: row.notes,
      preparedByUserId: row.prepared_by_user_id,
      preparedAt: row.prepared_at,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewedAt: row.reviewed_at,
      approvedByUserId: row.approved_by_user_id,
      approvedAt: row.approved_at,
      processedByUserId: row.processed_by_user_id,
      processingStartedAt: row.processing_started_at,
      paidAt: row.paid_at,
      closedByUserId: row.closed_by_user_id,
      closedAt: row.closed_at,
      separationOverrideReason: row.separation_override_reason,
      runVersion: row.run_version,
      contentChecksum: row.content_checksum,
      submittedForReviewByUserId: row.submitted_for_review_by_user_id,
      submittedForReviewAt: row.submitted_for_review_at,
      pendingApprovalAt: row.pending_approval_at,
      createdAt: row.created_at,
    };
  }

  private runSelectSql() {
    return `
      SELECT
        id,
        payroll_number,
        period_label,
        period_start::text AS period_start,
        period_end::text AS period_end,
        payroll_status::text AS payroll_status,
        currency_code,
        total_gross::text AS total_gross,
        total_allowances::text AS total_allowances,
        total_deductions::text AS total_deductions,
        total_net::text AS total_net,
        notes,
        prepared_by_user_id,
        prepared_at::text AS prepared_at,
        reviewed_by_user_id,
        reviewed_at::text AS reviewed_at,
        approved_by_user_id,
        approved_at::text AS approved_at,
        processed_by_user_id,
        processing_started_at::text AS processing_started_at,
        paid_at::text AS paid_at,
        closed_by_user_id,
        closed_at::text AS closed_at,
        separation_override_reason,
        run_version,
        content_checksum,
        submitted_for_review_by_user_id,
        submitted_for_review_at::text AS submitted_for_review_at,
        pending_approval_at::text AS pending_approval_at,
        created_at::text AS created_at
      FROM payroll_runs
    `;
  }

  async listPayrollRuns(
    query: { schoolId: string },
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actor = await this.assertUserCanAccessFinance(
      actorUserId,
      query.schoolId,
      platformRole,
    );
    const result = await this.db.query<PayrollRunRow>(
      `${this.runSelectSql()}
      WHERE school_id = $1
        AND deleted_at IS NULL
      ORDER BY period_start DESC, created_at DESC
      LIMIT 100`,
      [query.schoolId],
    );
    return result.rows.map((row) => ({
      ...this.mapRun(row),
      capabilities: this.capabilities(row.payroll_status, actor),
    }));
  }

  async listApprovalInbox(
    query: { schoolId: string },
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actor = await this.assertUserCanAccessFinance(
      actorUserId,
      query.schoolId,
      platformRole,
    );
    this.assertActiveSchoolAdmin(actor);
    const result = await this.db.query<{
      id: string;
      payroll_number: string | null;
      period_label: string;
      period_start: string;
      period_end: string;
      currency_code: string;
      total_gross: string;
      total_allowances: string;
      total_deductions: string;
      total_net: string;
      staff_count: string;
      run_version: number;
      content_checksum: string;
      prepared_by_user_id: string;
      prepared_by_full_name: string;
      reviewed_by_user_id: string;
      reviewed_by_full_name: string;
      pending_approval_at: string;
    }>(
      `
      SELECT
        run.id,
        run.payroll_number,
        run.period_label,
        run.period_start::text AS period_start,
        run.period_end::text AS period_end,
        run.currency_code,
        run.total_gross::text AS total_gross,
        run.total_allowances::text AS total_allowances,
        run.total_deductions::text AS total_deductions,
        run.total_net::text AS total_net,
        (
          SELECT COUNT(*)::text
          FROM payroll_run_items item
          WHERE item.school_id=run.school_id
            AND item.payroll_run_id=run.id
            AND item.deleted_at IS NULL
        ) AS staff_count,
        run.run_version,
        run.content_checksum,
        run.prepared_by_user_id,
        COALESCE(
          NULLIF(BTRIM(CONCAT_WS(' ', prepared.first_name, prepared.last_name)), ''),
          prepared.email_original
        ) AS prepared_by_full_name,
        run.reviewed_by_user_id,
        COALESCE(
          NULLIF(BTRIM(CONCAT_WS(' ', reviewed.first_name, reviewed.last_name)), ''),
          reviewed.email_original
        ) AS reviewed_by_full_name,
        run.pending_approval_at::text AS pending_approval_at
      FROM payroll_runs run
      JOIN users prepared
        ON prepared.id=run.prepared_by_user_id
       AND prepared.deleted_at IS NULL
      JOIN users reviewed
        ON reviewed.id=run.reviewed_by_user_id
       AND reviewed.deleted_at IS NULL
      WHERE run.school_id=$1
        AND run.payroll_status='PENDING_APPROVAL'
        AND run.content_checksum IS NOT NULL
        AND run.pending_approval_at IS NOT NULL
        AND run.deleted_at IS NULL
      ORDER BY run.pending_approval_at ASC,run.created_at ASC
      `,
      [query.schoolId],
    );
    const runs = result.rows.map((row) => ({
      id: row.id,
      payrollNumber: row.payroll_number,
      periodLabel: row.period_label,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      currencyCode: row.currency_code,
      totalGross: Number(row.total_gross),
      totalAllowances: Number(row.total_allowances),
      totalDeductions: Number(row.total_deductions),
      totalNet: Number(row.total_net),
      staffCount: Number(row.staff_count),
      runVersion: row.run_version,
      contentChecksum: row.content_checksum,
      preparedBy: {
        id: row.prepared_by_user_id,
        fullName: row.prepared_by_full_name,
      },
      reviewedBy: {
        id: row.reviewed_by_user_id,
        fullName: row.reviewed_by_full_name,
      },
      pendingApprovalAt: row.pending_approval_at,
    }));
    return { runs, count: runs.length };
  }
  private async recordRunEventTx(
    client: PoolClient,
    input: {
      schoolId: string;
      payrollRunId: string;
      eventType: string;
      fromStatus?: string | null;
      toStatus?: string | null;
      actorUserId: string;
      note?: string | null;
      payload?: Record<string, unknown>;
    },
  ) {
    await client.query(
      `
      INSERT INTO payroll_run_events (
        school_id,
        payroll_run_id,
        event_type,
        from_status,
        to_status,
        actor_user_id,
        note,
        payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      `,
      [
        input.schoolId,
        input.payrollRunId,
        input.eventType,
        input.fromStatus ?? null,
        input.toStatus ?? null,
        input.actorUserId,
        input.note ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  }

  async createPayrollRun(
    dto: CreatePayrollRunDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actor = await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );
    this.assertCanPrepare(actor);
    const periodLabel = dto.periodLabel.trim();
    if (!periodLabel) {
      throw new BadRequestException('Payroll period label is required.');
    }
    if (new Date(dto.periodStart) > new Date(dto.periodEnd)) {
      throw new BadRequestException(
        'Payroll period end must be on or after its start date.',
      );
    }
    const currencyCode = this.currency(dto.currencyCode);
    try {
      return await this.db.withTransaction(async (client) => {
        const duplicate = await client.query(
          `
          SELECT id
          FROM payroll_runs
          WHERE school_id = $1
            AND period_start = $2::date
            AND period_end = $3::date
            AND payroll_status::text <> 'CANCELLED'
            AND deleted_at IS NULL
          LIMIT 1
          FOR UPDATE
          `,
          [dto.schoolId, dto.periodStart, dto.periodEnd],
        );
        if (duplicate.rowCount) {
          throw new ConflictException(
            'A payroll run already exists for this pay period.',
          );
        }
        const profiles = await client.query<{
          id: string;
          staff_account_id: string;
          compensation_version_id: string;
          compensation_type: 'SALARY' | 'HOURLY' | 'DAILY';
          full_name: string;
          staff_code: string | null;
          position_title: string | null;
          department: string | null;
          employment_type: string;
          pay_frequency: string;
          base_salary: string;
          currency_code: string;
          standard_allowances: Array<{
            code: string;
            description: string;
            amount: number;
          }>;
          standard_deductions: Array<{
            code: string;
            description: string;
            amount: number;
          }>;
        }>(
          `
          SELECT
            profile.id,
            profile.school_staff_account_id AS staff_account_id,
            compensation.id AS compensation_version_id,
            compensation.compensation_type,
            profile.full_name,
            profile.staff_code,
            COALESCE(profile.position_title, profile.job_title) AS position_title,
            profile.department,
            profile.employment_type,
            compensation.pay_frequency,
            compensation.base_amount::text AS base_salary,
            compensation.currency_code,
            compensation.standard_allowances,
            compensation.standard_deductions
          FROM payroll_staff_profiles profile
          JOIN school_staff_accounts staff
            ON staff.id = profile.school_staff_account_id
           AND staff.school_id = profile.school_id
           AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED')
           AND staff.deleted_at IS NULL
           AND (staff.hire_date IS NULL OR staff.hire_date <= $3::date)
           AND (
             staff.termination_date IS NULL
             OR staff.termination_date >= $2::date
           )
          JOIN LATERAL (
            SELECT version.*
            FROM payroll_compensation_versions version
            WHERE version.school_id = profile.school_id
              AND version.payroll_staff_profile_id = profile.id
              AND version.effective_from <= $2::date
            ORDER BY version.effective_from DESC, version.created_at DESC
            LIMIT 1
          ) compensation ON TRUE
          WHERE profile.school_id = $1
            AND profile.payroll_active = TRUE
            AND profile.deleted_at IS NULL
          ORDER BY profile.full_name ASC
          FOR UPDATE OF profile
          `,
          [dto.schoolId, dto.periodStart, dto.periodEnd],
        );
        if (!profiles.rows.length) {
          throw new BadRequestException(
            'No payroll-eligible staff have compensation effective for this period.',
          );
        }
        const currencies = [
          ...new Set(
            profiles.rows.map((row) => row.currency_code.toUpperCase()),
          ),
        ];
        if (currencies.length !== 1 || currencies[0] !== currencyCode) {
          throw new BadRequestException(
            `All included compensation versions must use the requested ${currencyCode} currency.`,
          );
        }        const numberResult = await client.query<{ payroll_number: string }>(
          'SELECT next_payroll_number($1) AS payroll_number',
          [dto.schoolId],
        );
        const payrollNumber = numberResult.rows[0].payroll_number;
        const runResult = await client.query<PayrollRunRow>(
          `
          INSERT INTO payroll_runs (
            school_id,
            payroll_number,
            period_label,
            period_start,
            period_end,
            payroll_status,
            currency_code,
            notes,
            created_by_user_id,
            prepared_by_user_id,
            prepared_at
          )
          VALUES ($1,$2,$3,$4::date,$5::date,'DRAFT',$6,$7,$8,$8,NOW())
          RETURNING
            id,
            payroll_number,
            period_label,
            period_start::text AS period_start,
            period_end::text AS period_end,
            payroll_status::text AS payroll_status,
            currency_code,
            total_gross::text AS total_gross,
            total_allowances::text AS total_allowances,
            total_deductions::text AS total_deductions,
            total_net::text AS total_net,
            notes,
            prepared_by_user_id,
            prepared_at::text AS prepared_at,
            reviewed_by_user_id,
            reviewed_at::text AS reviewed_at,
            approved_by_user_id,
            approved_at::text AS approved_at,
            processed_by_user_id,
            processing_started_at::text AS processing_started_at,
            paid_at::text AS paid_at,
            closed_by_user_id,
            closed_at::text AS closed_at,
            separation_override_reason,
            run_version,
            content_checksum,
            submitted_for_review_by_user_id,
            submitted_for_review_at::text AS submitted_for_review_at,
            pending_approval_at::text AS pending_approval_at,
            created_at::text AS created_at
          `,
          [
            dto.schoolId,
            payrollNumber,
            periodLabel,
            dto.periodStart,
            dto.periodEnd,
            currencyCode,
            dto.notes?.trim() || null,
            actorUserId,
          ],
        );
        const run = runResult.rows[0];
        let totalGross = 0;
        let totalAllowances = 0;
        let totalDeductions = 0;
        let totalNet = 0;
        for (const profile of profiles.rows) {
          const grossSalary = money(Number(profile.base_salary));
          const allowances = money(
            profile.standard_allowances.reduce(
              (sum, line) => sum + Number(line.amount),
              0,
            ),
          );
          const deductions = money(
            profile.standard_deductions.reduce(
              (sum, line) => sum + Number(line.amount),
              0,
            ),
          );
          const netSalary = money(grossSalary + allowances - deductions);
          if (netSalary < 0) {
            throw new BadRequestException(
              `Standard deductions exceed compensation for ${profile.full_name}.`,
            );
          }
          totalGross = money(totalGross + grossSalary);
          totalAllowances = money(totalAllowances + allowances);
          totalDeductions = money(totalDeductions + deductions);
          totalNet = money(totalNet + netSalary);
          const itemResult = await client.query<{ id: string }>(
            `
            INSERT INTO payroll_run_items (
              school_id,
              payroll_run_id,
              payroll_staff_profile_id,
              staff_account_id,
              compensation_version_id,
              currency_code,
              snapshot_full_name,
              snapshot_staff_code,
              snapshot_position_title,
              snapshot_department,
              snapshot_employment_type,
              snapshot_pay_frequency,
              snapshot_compensation_type,
              snapshot_base_salary,
              gross_salary,
              allowances,
              deductions,
              net_salary,
              payment_status
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
              $14,$14,$15,$16,$17,'PENDING'
            )
            RETURNING id
            `,
            [
              dto.schoolId,
              run.id,
              profile.id,
              profile.staff_account_id,
              profile.compensation_version_id,
              currencyCode,
              profile.full_name,
              profile.staff_code,
              profile.position_title,
              profile.department,
              profile.employment_type,
              profile.pay_frequency,
              profile.compensation_type,
              grossSalary,
              allowances,
              deductions,
              netSalary,
            ],
          );
          for (const [type, lines] of [
            ['ALLOWANCE', profile.standard_allowances],
            ['DEDUCTION', profile.standard_deductions],
          ] as const) {
            for (const line of lines) {
              await client.query(
                `
                INSERT INTO payroll_item_adjustments (
                  school_id,
                  payroll_run_item_id,
                  adjustment_type,
                  adjustment_code,
                  description,
                  amount,
                  created_by_user_id
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7)
                `,
                [
                  dto.schoolId,
                  itemResult.rows[0].id,
                  type,
                  line.code.toUpperCase(),
                  line.description,
                  money(Number(line.amount)),
                  actorUserId,
                ],
              );
            }
          }
        }
        await client.query(
          `
          UPDATE payroll_runs
          SET
            total_gross = $3,
            total_allowances = $4,
            total_deductions = $5,
            total_net = $6,
            updated_at = NOW()
          WHERE id = $1 AND school_id = $2
          `,
          [
            run.id,
            dto.schoolId,
            totalGross,
            totalAllowances,
            totalDeductions,
            totalNet,
          ],
        );
        await this.recordRunEventTx(client, {
          schoolId: dto.schoolId,
          payrollRunId: run.id,
          eventType: 'CREATED',
          toStatus: 'DRAFT',
          actorUserId,
          note: dto.notes?.trim() || null,
          payload: {
            payrollNumber,
            periodStart: dto.periodStart,
            periodEnd: dto.periodEnd,
            currencyCode,
            staffCount: profiles.rows.length,
            totalGross,
            totalAllowances,
            totalDeductions,
            totalNet,
          },
        });
        await this.platformActivityService.recordTx(client, {
          eventType: 'PAYROLL_RUN_CREATED',
          actorType: this.actorType(platformRole),
          actorUserId,
          schoolId: dto.schoolId,
          summary: `Payroll run ${payrollNumber} created for ${periodLabel}.`,
          payload: {
            payrollRunId: run.id,
            payrollNumber,
            periodLabel,
            staffCount: profiles.rows.length,
            totalGross,
            currencyCode,
          },
        });
        return {
          ...this.mapRun({
            ...run,
            total_gross: String(totalGross),
            total_allowances: String(totalAllowances),
            total_deductions: String(totalDeductions),
            total_net: String(totalNet),
          }),
          staffCount: profiles.rows.length,
        };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'A payroll run already exists for this pay period.',
        );
      }
      throw error;
    }
  }
  private capabilities(status: PayrollRunStatus, actor: PayrollActorContext) {
    const canPrepare =
      actor.isSchoolAdmin ||
      (actor.isFinanceAdmin &&
        this.hasPayrollPermission(actor, 'PAYROLL_PREPARE'));
    const canReview =
      actor.isSchoolAdmin ||
      (actor.isFinanceAdmin &&
        this.hasPayrollPermission(actor, 'PAYROLL_REVIEW'));
    const canProcess =
      actor.isSchoolAdmin ||
      (actor.isFinanceAdmin &&
        this.hasPayrollPermission(actor, 'PAYROLL_PROCESS'));
    const canReverse =
      actor.isSchoolAdmin ||
      (actor.isFinanceAdmin &&
        this.hasPayrollPermission(actor, 'PAYROLL_REVERSE'));
    return {
      canEditAdjustments: status === 'DRAFT' && canPrepare,
      canSubmitForReview: status === 'DRAFT' && canPrepare,
      canReturnToDraft:
        ((status === 'UNDER_REVIEW' || status === 'REVIEWED') && canReview) ||
        ((status === 'PENDING_APPROVAL' || status === 'APPROVED') &&
          actor.isSchoolAdmin),
      canCompleteReview:
        (status === 'UNDER_REVIEW' || status === 'REVIEWED') && canReview,
      canApprove: status === 'PENDING_APPROVAL' && actor.isSchoolAdmin,
      canStartProcessing: status === 'APPROVED' && canProcess,
      canMarkPayments: status === 'PROCESSING' && canProcess,
      canMarkPaid: false,
      canClose: status === 'PAID' && actor.isSchoolAdmin,
      canReversePayments:
        (status === 'PROCESSING' || status === 'PAID') && canReverse,
    };
  }
  private mapAdjustment(row: AdjustmentRow) {
    return {
      id: row.id,
      type: row.adjustment_type,
      code: row.adjustment_code,
      description: row.description,
      amount: Number(row.amount),
    };
  }

  private mapReversal(row: ReversalRow) {
    return {
      id: row.id,
      reason: row.reason,
      originalPaidAt: row.original_paid_at,
      originalPaymentMethod: row.original_payment_method,
      originalPaymentReference: row.original_payment_reference,
      reversedByUserId: row.reversed_by_user_id,
      reversedAt: row.reversed_at,
    };
  }

  private mapItem(
    row: PayrollItemRow,
    adjustments: AdjustmentRow[],
    reversals: ReversalRow[],
  ) {
    const snapshot = {
      fullName: row.snapshot_full_name,
      staffCode: row.snapshot_staff_code,
      positionTitle: row.snapshot_position_title,
      department: row.snapshot_department,
      employmentType: row.snapshot_employment_type,
      payFrequency: row.snapshot_pay_frequency,
      currencyCode: row.currency_code,
      baseSalary: Number(row.snapshot_base_salary),
    };
    return {
      id: row.id,
      payrollStaffProfileId: row.payroll_staff_profile_id,
      staffAccountId: row.staff_account_id,
      currencyCode: row.currency_code,
      grossSalary: Number(row.gross_salary),
      allowances: Number(row.allowances),
      deductions: Number(row.deductions),
      netSalary: Number(row.net_salary),
      paymentStatus: row.payment_status,
      paidAt: row.paid_at,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      notes: row.notes,
      staff: snapshot,
      snapshot,
      adjustmentLines: adjustments.map((line) => this.mapAdjustment(line)),
      reversals: reversals.map((reversal) => this.mapReversal(reversal)),
    };
  }

  async getPayrollRunDetails(
    input: { schoolId: string; payrollRunId: string },
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actor = await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );
    const runResult = await this.db.query<PayrollRunRow>(
      `${this.runSelectSql()}
       WHERE id=$1 AND school_id=$2 AND deleted_at IS NULL
       LIMIT 1`,
      [input.payrollRunId, input.schoolId],
    );
    const run = runResult.rows[0];
    if (!run) {
      throw new NotFoundException('Payroll run not found for this school.');
    }
    const [itemsResult, adjustmentsResult, reversalsResult, eventsResult] =
      await Promise.all([
        this.db.query<PayrollItemRow>(
          `
          SELECT
            id,
            payroll_staff_profile_id,
            staff_account_id,
            currency_code,
            gross_salary::text AS gross_salary,
            allowances::text AS allowances,
            deductions::text AS deductions,
            net_salary::text AS net_salary,
            payment_status::text AS payment_status,
            paid_at::text AS paid_at,
            payment_method,
            payment_reference,
            notes,
            snapshot_full_name,
            snapshot_staff_code,
            snapshot_position_title,
            snapshot_department,
            snapshot_employment_type,
            snapshot_pay_frequency,
            snapshot_base_salary::text AS snapshot_base_salary
          FROM payroll_run_items
          WHERE school_id=$1 AND payroll_run_id=$2 AND deleted_at IS NULL
          ORDER BY snapshot_full_name ASC
          `,
          [input.schoolId, input.payrollRunId],
        ),
        this.db.query<AdjustmentRow>(
          `
          SELECT
            adjustment.id,
            adjustment.payroll_run_item_id,
            adjustment.adjustment_type,
            adjustment.adjustment_code,
            adjustment.description,
            adjustment.amount::text AS amount
          FROM payroll_item_adjustments adjustment
          JOIN payroll_run_items item
            ON item.id=adjustment.payroll_run_item_id
           AND item.payroll_run_id=$2
           AND item.school_id=$1
           AND item.deleted_at IS NULL
          WHERE adjustment.school_id=$1 AND adjustment.deleted_at IS NULL
          ORDER BY adjustment.adjustment_type,adjustment.adjustment_code
          `,
          [input.schoolId, input.payrollRunId],
        ),
        this.db.query<ReversalRow>(
          `
          SELECT
            id,
            payroll_run_item_id,
            original_paid_at::text AS original_paid_at,
            original_payment_method,
            original_payment_reference,
            reason,
            reversed_by_user_id,
            reversed_at::text AS reversed_at
          FROM payroll_payment_reversals
          WHERE school_id=$1 AND payroll_run_id=$2
          ORDER BY reversed_at DESC
          `,
          [input.schoolId, input.payrollRunId],
        ),
        this.db.query<{
          id: string;
          event_type: string;
          from_status: string | null;
          to_status: string | null;
          actor_user_id: string;
          note: string | null;
          payload: Record<string, unknown>;
          created_at: string;
        }>(
          `
          SELECT
            id,
            event_type,
            from_status,
            to_status,
            actor_user_id,
            note,
            payload,
            created_at::text AS created_at
          FROM payroll_run_events
          WHERE school_id=$1 AND payroll_run_id=$2
          ORDER BY created_at ASC,id ASC
          `,
          [input.schoolId, input.payrollRunId],
        ),
      ]);
    const approvalsResult = await this.db.query<{
      id: string;
      run_version: number;
      content_checksum: string;
      total_gross: string;
      total_allowances: string;
      total_deductions: string;
      total_net: string;
      staff_count: number;
      decision: 'APPROVED' | 'RETURNED';
      actor_user_id: string;
      actor_role: 'SCHOOL_ADMIN';
      note: string | null;
      created_at: string;
    }>(
      `
      SELECT
        id,
        run_version,
        content_checksum,
        total_gross::text AS total_gross,
        total_allowances::text AS total_allowances,
        total_deductions::text AS total_deductions,
        total_net::text AS total_net,
        staff_count,
        decision,
        actor_user_id,
        actor_role,
        note,
        created_at::text AS created_at
      FROM payroll_run_approvals
      WHERE school_id=$1 AND payroll_run_id=$2
      ORDER BY created_at ASC,id ASC
      `,
      [input.schoolId, input.payrollRunId],
    );
    const adjustmentsByItem = new Map<string, AdjustmentRow[]>();
    for (const adjustment of adjustmentsResult.rows) {
      const current =
        adjustmentsByItem.get(adjustment.payroll_run_item_id) ?? [];
      current.push(adjustment);
      adjustmentsByItem.set(adjustment.payroll_run_item_id, current);
    }
    const reversalsByItem = new Map<string, ReversalRow[]>();
    for (const reversal of reversalsResult.rows) {
      const current = reversalsByItem.get(reversal.payroll_run_item_id) ?? [];
      current.push(reversal);
      reversalsByItem.set(reversal.payroll_run_item_id, current);
    }
    return {
      run: this.mapRun(run),
      items: itemsResult.rows.map((item) =>
        this.mapItem(
          item,
          adjustmentsByItem.get(item.id) ?? [],
          reversalsByItem.get(item.id) ?? [],
        ),
      ),
      events: eventsResult.rows.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        fromStatus: event.from_status,
        toStatus: event.to_status,
        actorUserId: event.actor_user_id,
        note: event.note,
        payload: event.payload,
        createdAt: event.created_at,
      })),
      approvals: approvalsResult.rows.map((approval) => ({
        id: approval.id,
        runVersion: approval.run_version,
        contentChecksum: approval.content_checksum,
        totals: {
          gross: Number(approval.total_gross),
          allowances: Number(approval.total_allowances),
          deductions: Number(approval.total_deductions),
          net: Number(approval.total_net),
        },
        staffCount: approval.staff_count,
        decision: approval.decision,
        actorUserId: approval.actor_user_id,
        actorRole: approval.actor_role,
        note: approval.note,
        createdAt: approval.created_at,
      })),
      actor: this.mapActor(actor),
      capabilities: this.capabilities(run.payroll_status, actor),
    };
  }

  private async eligiblePayrollReviewerCountTx(
    client: PoolClient,
    schoolId: string,
  ) {
    const result = await client.query<{ count: string }>(
      `
      SELECT COUNT(DISTINCT membership.user_id)::text AS count
      FROM school_memberships membership
      JOIN school_membership_roles role
        ON role.school_membership_id=membership.id
       AND role.deleted_at IS NULL
      WHERE membership.school_id=$1
        AND membership.membership_status='ACTIVE'
        AND membership.deleted_at IS NULL
        AND (
          role.role='SCHOOL_ADMIN'
          OR (
            role.role='FINANCE_ADMIN'
            AND EXISTS (
              SELECT 1
              FROM school_user_permissions permission
              WHERE permission.school_id=membership.school_id
                AND permission.user_id=membership.user_id
                AND permission.permission_code IN (
                  'PAYROLL_REVIEW',
                  'PAYROLL_MANAGE'
                )
                AND permission.deleted_at IS NULL
            )
          )
        )
      `,
      [schoolId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async activeSchoolAdminCountTx(client: PoolClient, schoolId: string) {
    const result = await client.query<{ count: string }>(
      `
      SELECT COUNT(DISTINCT membership.user_id)::text AS count
      FROM school_memberships membership
      JOIN school_membership_roles role
        ON role.school_membership_id=membership.id
       AND role.role='SCHOOL_ADMIN'
       AND role.deleted_at IS NULL
      WHERE membership.school_id=$1
        AND membership.membership_status='ACTIVE'
        AND membership.deleted_at IS NULL
      `,
      [schoolId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async computeRunChecksumTx(
    client: PoolClient,
    input: {
      schoolId: string;
      payrollRunId: string;
      runVersion: number;
      periodLabel: string;
      periodStart: string;
      periodEnd: string;
      currencyCode: string;
      totalGross: string;
      totalAllowances: string;
      totalDeductions: string;
      totalNet: string;
    },
  ) {
    const itemsResult = await client.query<{
      id: string;
      payroll_staff_profile_id: string;
      staff_account_id: string;
      snapshot_full_name: string;
      snapshot_staff_code: string | null;
      snapshot_position_title: string | null;
      snapshot_department: string | null;
      snapshot_base_salary: string;
      gross_salary: string;
      allowances: string;
      deductions: string;
      net_salary: string;
      adjustments: unknown;
    }>(
      `
      SELECT
        item.id,
        item.payroll_staff_profile_id,
        item.staff_account_id,
        item.snapshot_full_name,
        item.snapshot_staff_code,
        item.snapshot_position_title,
        item.snapshot_department,
        item.snapshot_base_salary::text AS snapshot_base_salary,
        item.gross_salary::text AS gross_salary,
        item.allowances::text AS allowances,
        item.deductions::text AS deductions,
        item.net_salary::text AS net_salary,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'type', adjustment.adjustment_type,
              'code', adjustment.adjustment_code,
              'description', adjustment.description,
              'amount', adjustment.amount::text
            )
            ORDER BY
              adjustment.adjustment_type,
              adjustment.adjustment_code,
              adjustment.id
          ) FILTER (WHERE adjustment.id IS NOT NULL),
          '[]'::jsonb
        ) AS adjustments
      FROM payroll_run_items item
      LEFT JOIN payroll_item_adjustments adjustment
        ON adjustment.payroll_run_item_id=item.id
       AND adjustment.school_id=item.school_id
       AND adjustment.deleted_at IS NULL
      WHERE item.school_id=$1
        AND item.payroll_run_id=$2
        AND item.deleted_at IS NULL
      GROUP BY item.id
      ORDER BY item.id
      `,
      [input.schoolId, input.payrollRunId],
    );
    const serialized = JSON.stringify({
      payrollRunId: input.payrollRunId,
      periodLabel: input.periodLabel,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      currencyCode: input.currencyCode,
      totals: {
        gross: input.totalGross,
        allowances: input.totalAllowances,
        deductions: input.totalDeductions,
        net: input.totalNet,
      },
      items: itemsResult.rows,
    });
    return {
      checksum: createHash('sha256').update(serialized).digest('hex'),
      staffCount: itemsResult.rows.length,
    };
  }

  private async recordApprovalDecisionTx(
    client: PoolClient,
    input: {
      schoolId: string;
      payrollRunId: string;
      runVersion: number;
      contentChecksum: string;
      totalGross: string;
      totalAllowances: string;
      totalDeductions: string;
      totalNet: string;
      staffCount: number;
      decision: 'APPROVED' | 'RETURNED';
      actorUserId: string;
      note: string | null;
    },
  ) {
    await client.query(
      `
      INSERT INTO payroll_run_approvals (
        school_id,
        payroll_run_id,
        run_version,
        content_checksum,
        total_gross,
        total_allowances,
        total_deductions,
        total_net,
        staff_count,
        decision,
        actor_user_id,
        actor_role,
        note
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SCHOOL_ADMIN',$12)
      `,
      [
        input.schoolId,
        input.payrollRunId,
        input.runVersion,
        input.contentChecksum,
        input.totalGross,
        input.totalAllowances,
        input.totalDeductions,
        input.totalNet,
        input.staffCount,
        input.decision,
        input.actorUserId,
        input.note,
      ],
    );
  }
  async updatePayrollRunStatus(
    payrollRunId: string,
    dto: UpdatePayrollRunStatusDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actor = await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );
    await this.db.withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        payroll_number: string | null;
        payroll_status: string;
        period_label: string;
        period_start: string;
        period_end: string;
        currency_code: string;
        total_gross: string;
        total_allowances: string;
        total_deductions: string;
        total_net: string;
        prepared_by_user_id: string;
        reviewed_by_user_id: string | null;
        run_version: number;
        content_checksum: string | null;
      }>(
        `
        SELECT
          id,
          payroll_number,
          payroll_status::text AS payroll_status,
          period_label,
          period_start::text AS period_start,
          period_end::text AS period_end,
          currency_code,
          total_gross::text AS total_gross,
          total_allowances::text AS total_allowances,
          total_deductions::text AS total_deductions,
          total_net::text AS total_net,
          prepared_by_user_id,
          reviewed_by_user_id,
          run_version,
          content_checksum
        FROM payroll_runs
        WHERE id=$1 AND school_id=$2 AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [payrollRunId, dto.schoolId],
      );
      const run = result.rows[0];
      if (!run) {
        throw new NotFoundException('Payroll run not found for this school.');
      }
      const currentStatus = run.payroll_status as PayrollRunStatus;
      const allowedTargets = STATUS_TRANSITIONS[currentStatus];
      if (!allowedTargets?.includes(dto.targetStatus)) {
        throw new ConflictException(
          `Payroll run cannot move from ${currentStatus} to ${dto.targetStatus}.`,
        );
      }
      const note = dto.note?.trim() || null;
      const returningToDraft = dto.targetStatus === 'DRAFT';
      if (returningToDraft && !note) {
        throw new BadRequestException(
          'A reason is required when returning payroll to draft.',
        );
      }

      if (dto.targetStatus === 'UNDER_REVIEW') {
        this.assertCanPrepare(actor);
      } else if (dto.targetStatus === 'PENDING_APPROVAL') {
        this.assertCanReview(actor);
      } else if (dto.targetStatus === 'APPROVED') {
        this.assertActiveSchoolAdmin(actor);
      } else if (
        dto.targetStatus === 'PROCESSING' ||
        dto.targetStatus === 'PAID'
      ) {
        this.assertCanProcess(actor);
      } else if (dto.targetStatus === 'CLOSED') {
        this.assertActiveSchoolAdmin(actor);
      } else if (returningToDraft) {
        if (
          currentStatus === 'PENDING_APPROVAL' ||
          currentStatus === 'APPROVED'
        ) {
          this.assertActiveSchoolAdmin(actor);
        } else {
          this.assertCanReview(actor);
        }
      }

      if (
        dto.targetStatus === 'PENDING_APPROVAL' &&
        run.prepared_by_user_id === actorUserId
      ) {
        const reviewerCount = await this.eligiblePayrollReviewerCountTx(
          client,
          dto.schoolId,
        );
        if (reviewerCount > 1) {
          throw new ConflictException(
            'The payroll preparer cannot complete review while another eligible reviewer is available.',
          );
        }
        if (!note) {
          throw new BadRequestException(
            'A sole-operator review note is required when the preparer completes review.',
          );
        }
      }

      if (
        dto.targetStatus === 'APPROVED' &&
        run.prepared_by_user_id === actorUserId
      ) {
        const activeAdminCount = await this.activeSchoolAdminCountTx(
          client,
          dto.schoolId,
        );
        if (activeAdminCount > 1) {
          throw new ConflictException(
            'The payroll preparer cannot approve their own run while another active School Administrator is available.',
          );
        }
        if (run.reviewed_by_user_id === actorUserId && !note) {
          throw new BadRequestException(
            'A sole-operator approval note is required when preparation, review, and approval are performed by the same administrator.',
          );
        }
      }

      const checksumResult = await this.computeRunChecksumTx(client, {
        schoolId: dto.schoolId,
        payrollRunId,
        runVersion: run.run_version,
        periodLabel: run.period_label,
        periodStart: run.period_start,
        periodEnd: run.period_end,
        currencyCode: run.currency_code,
        totalGross: run.total_gross,
        totalAllowances: run.total_allowances,
        totalDeductions: run.total_deductions,
        totalNet: run.total_net,
      });
      const expectedChecksum = run.content_checksum;
      if (
        ['PENDING_APPROVAL', 'APPROVED'].includes(dto.targetStatus) &&
        expectedChecksum &&
        expectedChecksum !== checksumResult.checksum
      ) {
        throw new ConflictException(
          'Payroll content changed after submission. Return the run to draft and review it again.',
        );
      }
      if (
        dto.targetStatus === 'PROCESSING' &&
        (!expectedChecksum || expectedChecksum !== checksumResult.checksum)
      ) {
        throw new ConflictException(
          'This payroll approval does not match the current payroll version.',
        );
      }

      if (dto.targetStatus === 'PROCESSING') {
        const approvalResult = await client.query(
          `
          SELECT id
          FROM payroll_run_approvals
          WHERE school_id=$1
            AND payroll_run_id=$2
            AND run_version=$3
            AND content_checksum=$4
            AND decision='APPROVED'
          LIMIT 1
          `,
          [dto.schoolId, payrollRunId, run.run_version, expectedChecksum],
        );
        if (!approvalResult.rowCount) {
          throw new ConflictException(
            'A current School Administrator approval is required before payroll processing can begin.',
          );
        }
      }

      if (dto.targetStatus === 'PAID' || dto.targetStatus === 'CLOSED') {
        const unsettled = await client.query<{ count: string }>(
          `
          SELECT COUNT(*)::text AS count
          FROM payroll_run_items
          WHERE school_id=$1 AND payroll_run_id=$2 AND deleted_at IS NULL
            AND payment_status::text <> 'PAID'
          `,
          [dto.schoolId, payrollRunId],
        );
        if (Number(unsettled.rows[0]?.count ?? 0) > 0) {
          throw new ConflictException(
            'Every payroll item must be paid before the run can be marked paid or closed.',
          );
        }
      }

      if (
        returningToDraft &&
        (currentStatus === 'PENDING_APPROVAL' || currentStatus === 'APPROVED')
      ) {
        await this.recordApprovalDecisionTx(client, {
          schoolId: dto.schoolId,
          payrollRunId,
          runVersion: run.run_version,
          contentChecksum: expectedChecksum ?? checksumResult.checksum,
          totalGross: run.total_gross,
          totalAllowances: run.total_allowances,
          totalDeductions: run.total_deductions,
          totalNet: run.total_net,
          staffCount: checksumResult.staffCount,
          decision: 'RETURNED',
          actorUserId,
          note,
        });
      }

      if (dto.targetStatus === 'APPROVED') {
        await this.recordApprovalDecisionTx(client, {
          schoolId: dto.schoolId,
          payrollRunId,
          runVersion: run.run_version,
          contentChecksum: expectedChecksum ?? checksumResult.checksum,
          totalGross: run.total_gross,
          totalAllowances: run.total_allowances,
          totalDeductions: run.total_deductions,
          totalNet: run.total_net,
          staffCount: checksumResult.staffCount,
          decision: 'APPROVED',
          actorUserId,
          note,
        });
      }

      if (dto.targetStatus === 'UNDER_REVIEW') {
        await client.query(
          `
          UPDATE payroll_runs
          SET
            payroll_status='UNDER_REVIEW',
            content_checksum=$3,
            submitted_for_review_by_user_id=$4,
            submitted_for_review_at=NOW(),
            reviewed_by_user_id=NULL,
            reviewed_at=NULL,
            pending_approval_at=NULL,
            approved_by_user_id=NULL,
            approved_at=NULL,
            separation_override_reason=NULL,
            updated_at=NOW()
          WHERE id=$1 AND school_id=$2
          `,
          [payrollRunId, dto.schoolId, checksumResult.checksum, actorUserId],
        );
      } else if (dto.targetStatus === 'PENDING_APPROVAL') {
        await client.query(
          `
          UPDATE payroll_runs
          SET
            payroll_status='PENDING_APPROVAL',
            content_checksum=$3,
            reviewed_by_user_id=$4,
            reviewed_at=NOW(),
            pending_approval_at=NOW(),
            approved_by_user_id=NULL,
            approved_at=NULL,
            separation_override_reason=NULL,
            updated_at=NOW()
          WHERE id=$1 AND school_id=$2
          `,
          [payrollRunId, dto.schoolId, checksumResult.checksum, actorUserId],
        );
      } else if (dto.targetStatus === 'APPROVED') {
        await client.query(
          `
          UPDATE payroll_runs
          SET
            payroll_status='APPROVED',
            approved_by_user_id=$3,
            approved_at=NOW(),
            separation_override_reason=CASE
              WHEN prepared_by_user_id=$3 THEN $4
              ELSE NULL
            END,
            updated_at=NOW()
          WHERE id=$1 AND school_id=$2
          `,
          [payrollRunId, dto.schoolId, actorUserId, note],
        );
      } else if (dto.targetStatus === 'PROCESSING') {
        await client.query(
          `
          UPDATE payroll_runs
          SET
            payroll_status='PROCESSING',
            processed_by_user_id=$3,
            processing_started_at=NOW(),
            updated_at=NOW()
          WHERE id=$1 AND school_id=$2
          `,
          [payrollRunId, dto.schoolId, actorUserId],
        );
      } else if (dto.targetStatus === 'PAID') {
        await client.query(
          `
          UPDATE payroll_runs
          SET payroll_status='PAID',paid_at=NOW(),updated_at=NOW()
          WHERE id=$1 AND school_id=$2
          `,
          [payrollRunId, dto.schoolId],
        );
      } else if (dto.targetStatus === 'CLOSED') {
        await client.query(
          `
          UPDATE payroll_runs
          SET
            payroll_status='CLOSED',
            closed_by_user_id=$3,
            closed_at=NOW(),
            updated_at=NOW()
          WHERE id=$1 AND school_id=$2
          `,
          [payrollRunId, dto.schoolId, actorUserId],
        );
      } else if (returningToDraft) {
        await client.query(
          `
          UPDATE payroll_runs
          SET
            payroll_status='DRAFT',
            run_version=run_version + CASE
              WHEN $3 IN ('PENDING_APPROVAL','APPROVED') THEN 1
              ELSE 0
            END,
            submitted_for_review_by_user_id=NULL,
            submitted_for_review_at=NULL,
            reviewed_by_user_id=NULL,
            reviewed_at=NULL,
            pending_approval_at=NULL,
            approved_by_user_id=NULL,
            approved_at=NULL,
            separation_override_reason=NULL,
            updated_at=NOW()
          WHERE id=$1 AND school_id=$2
          `,
          [payrollRunId, dto.schoolId, currentStatus],
        );
      }

      await this.recordRunEventTx(client, {
        schoolId: dto.schoolId,
        payrollRunId,
        eventType:
          returningToDraft &&
          (currentStatus === 'PENDING_APPROVAL' || currentStatus === 'APPROVED')
            ? 'APPROVAL_RETURNED'
            : 'STATUS_CHANGED',
        fromStatus: currentStatus,
        toStatus: dto.targetStatus,
        actorUserId,
        note,
        payload: {
          runVersion: run.run_version,
          contentChecksum:
            dto.targetStatus === 'UNDER_REVIEW' ||
            dto.targetStatus === 'PENDING_APPROVAL' ||
            dto.targetStatus === 'APPROVED'
              ? checksumResult.checksum
              : expectedChecksum,
        },
      });
      await this.platformActivityService.recordTx(client, {
        eventType: 'PAYROLL_RUN_STATUS_CHANGED',
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Payroll run ${run.payroll_number ?? payrollRunId} moved from ${currentStatus} to ${dto.targetStatus}.`,
        payload: {
          payrollRunId,
          previousStatus: currentStatus,
          newStatus: dto.targetStatus,
          runVersion: run.run_version,
        },
      });
    });
    return this.getPayrollRunDetails(
      { schoolId: dto.schoolId, payrollRunId },
      actorUserId,
      platformRole,
    );
  }
  private normalizeAdjustmentLines(
    type: 'ALLOWANCE' | 'DEDUCTION',
    lines: PayrollAdjustmentLineDto[],
  ) {
    const seen = new Set<string>();
    return lines.map((line) => {
      const code = line.code.trim().toUpperCase();
      const description = line.description.trim();
      const amount = money(Number(line.amount));
      if (!description) {
        throw new BadRequestException('Adjustment descriptions are required.');
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException('Adjustment amounts must be positive.');
      }
      const key = `${type}:${code}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate payroll adjustment code: ${code}`,
        );
      }
      seen.add(key);
      return { type, code, description, amount };
    });
  }

  private async recalculateRunTotalsTx(
    client: PoolClient,
    schoolId: string,
    payrollRunId: string,
  ) {
    const result = await client.query<{
      total_gross: string;
      total_allowances: string;
      total_deductions: string;
      total_net: string;
    }>(
      `
      SELECT
        COALESCE(SUM(gross_salary),0)::text AS total_gross,
        COALESCE(SUM(allowances),0)::text AS total_allowances,
        COALESCE(SUM(deductions),0)::text AS total_deductions,
        COALESCE(SUM(net_salary),0)::text AS total_net
      FROM payroll_run_items
      WHERE school_id=$1 AND payroll_run_id=$2 AND deleted_at IS NULL
      `,
      [schoolId, payrollRunId],
    );
    const totals = result.rows[0];
    await client.query(
      `
      UPDATE payroll_runs
      SET total_gross=$3,total_allowances=$4,total_deductions=$5,total_net=$6,updated_at=NOW()
      WHERE id=$1 AND school_id=$2 AND deleted_at IS NULL
      `,
      [
        payrollRunId,
        schoolId,
        totals.total_gross,
        totals.total_allowances,
        totals.total_deductions,
        totals.total_net,
      ],
    );
    return {
      totalGross: Number(totals.total_gross),
      totalAllowances: Number(totals.total_allowances),
      totalDeductions: Number(totals.total_deductions),
      totalNet: Number(totals.total_net),
    };
  }
  async updatePayrollItemAdjustments(
    payrollItemId: string,
    dto: UpdatePayrollItemAdjustmentsDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actor = await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );
    this.assertCanPrepare(actor);
    const lines = [
      ...this.normalizeAdjustmentLines('ALLOWANCE', dto.allowances),
      ...this.normalizeAdjustmentLines('DEDUCTION', dto.deductions),
    ];
    const result = await this.db.withTransaction(async (client) => {
      const itemResult = await client.query<{
        id: string;
        payroll_run_id: string;
        payroll_status: string;
        gross_salary: string;
        allowances: string;
        deductions: string;
        net_salary: string;
        snapshot_full_name: string;
      }>(
        `
        SELECT
          item.id,
          item.payroll_run_id,
          run.payroll_status::text AS payroll_status,
          item.gross_salary::text AS gross_salary,
          item.allowances::text AS allowances,
          item.deductions::text AS deductions,
          item.net_salary::text AS net_salary,
          item.snapshot_full_name
        FROM payroll_run_items item
        JOIN payroll_runs run
          ON run.id=item.payroll_run_id
         AND run.school_id=item.school_id
         AND run.deleted_at IS NULL
        WHERE item.id=$1 AND item.school_id=$2 AND item.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE OF item,run
        `,
        [payrollItemId, dto.schoolId],
      );
      const item = itemResult.rows[0];
      if (!item) {
        throw new NotFoundException('Payroll item not found for this school.');
      }
      if (item.payroll_status !== 'DRAFT') {
        throw new ConflictException(
          'Payroll adjustments can only be changed while the run is in draft.',
        );
      }
      const allowances = money(
        lines
          .filter((line) => line.type === 'ALLOWANCE')
          .reduce((sum, line) => sum + line.amount, 0),
      );
      const deductions = money(
        lines
          .filter((line) => line.type === 'DEDUCTION')
          .reduce((sum, line) => sum + line.amount, 0),
      );
      const grossSalary = Number(item.gross_salary);
      const netSalary = money(grossSalary + allowances - deductions);
      if (netSalary < 0) {
        throw new BadRequestException(
          'Payroll deductions cannot make net salary negative.',
        );
      }
      const beforeState = {
        grossSalary,
        allowances: Number(item.allowances),
        deductions: Number(item.deductions),
        netSalary: Number(item.net_salary),
      };
      const afterState = { grossSalary, allowances, deductions, netSalary };
      await client.query(
        `
        UPDATE payroll_item_adjustments
        SET deleted_at=NOW(),updated_at=NOW()
        WHERE school_id=$1 AND payroll_run_item_id=$2 AND deleted_at IS NULL
        `,
        [dto.schoolId, payrollItemId],
      );
      for (const line of lines) {
        await client.query(
          `
          INSERT INTO payroll_item_adjustments (
            school_id,
            payroll_run_item_id,
            adjustment_type,
            adjustment_code,
            description,
            amount,
            created_by_user_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          `,
          [
            dto.schoolId,
            payrollItemId,
            line.type,
            line.code,
            line.description,
            line.amount,
            actorUserId,
          ],
        );
      }
      await client.query(
        `
        UPDATE payroll_run_items
        SET allowances=$3,deductions=$4,net_salary=$5,updated_at=NOW()
        WHERE id=$1 AND school_id=$2
        `,
        [payrollItemId, dto.schoolId, allowances, deductions, netSalary],
      );
      await client.query(
        `
        INSERT INTO payroll_item_change_log (
          school_id,
          payroll_run_id,
          payroll_run_item_id,
          change_type,
          reason,
          before_state,
          after_state,
          actor_user_id
        )
        VALUES ($1,$2,$3,'ADJUSTMENTS_UPDATED',$4,$5::jsonb,$6::jsonb,$7)
        `,
        [
          dto.schoolId,
          item.payroll_run_id,
          payrollItemId,
          dto.reason?.trim() || null,
          JSON.stringify(beforeState),
          JSON.stringify({ ...afterState, adjustmentLines: lines }),
          actorUserId,
        ],
      );
      const runTotals = await this.recalculateRunTotalsTx(
        client,
        dto.schoolId,
        item.payroll_run_id,
      );
      const versionResult = await client.query<{ run_version: number }>(
        `
        UPDATE payroll_runs
        SET
          run_version=run_version + 1,
          content_checksum=NULL,
          submitted_for_review_by_user_id=NULL,
          submitted_for_review_at=NULL,
          reviewed_by_user_id=NULL,
          reviewed_at=NULL,
          pending_approval_at=NULL,
          approved_by_user_id=NULL,
          approved_at=NULL,
          separation_override_reason=NULL,
          updated_at=NOW()
        WHERE id=$1 AND school_id=$2 AND payroll_status='DRAFT'
        RETURNING run_version
        `,
        [item.payroll_run_id, dto.schoolId],
      );
      const runVersion = versionResult.rows[0]?.run_version;
      await this.recordRunEventTx(client, {
        schoolId: dto.schoolId,
        payrollRunId: item.payroll_run_id,
        eventType: 'ITEM_ADJUSTMENTS_UPDATED',
        fromStatus: 'DRAFT',
        toStatus: 'DRAFT',
        actorUserId,
        note: dto.reason?.trim() || null,
        payload: {
          payrollItemId,
          beforeState,
          afterState,
          runVersion,
        },
      });
      await this.platformActivityService.recordTx(client, {
        eventType: 'PAYROLL_ITEM_ADJUSTMENTS_UPDATED',
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Payroll adjustments updated for ${item.snapshot_full_name}.`,
        payload: {
          payrollRunId: item.payroll_run_id,
          payrollItemId,
          beforeState,
          afterState,
        },
      });
      return { payrollRunId: item.payroll_run_id, runTotals };
    });
    const details = await this.getPayrollRunDetails(
      { schoolId: dto.schoolId, payrollRunId: result.payrollRunId },
      actorUserId,
      platformRole,
    );
    return {
      item: details.items.find((item) => item.id === payrollItemId),
      runTotals: result.runTotals,
    };
  }

  async markPayrollItemPaid(
    payrollItemId: string,
    dto: MarkPayrollItemPaidDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actor = await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );
    this.assertCanProcess(actor);
    return this.db.withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        payroll_run_id: string;
        payment_status: string;
        net_salary: string;
        snapshot_full_name: string;
        payroll_number: string | null;
        period_label: string;
        payroll_status: string;
        paid_at: string | null;
        payment_method: string | null;
        payment_reference: string | null;
      }>(
        `
        SELECT
          item.id,
          item.payroll_run_id,
          item.payment_status::text AS payment_status,
          item.net_salary::text AS net_salary,
          item.snapshot_full_name,
          item.paid_at::text AS paid_at,
          item.payment_method,
          item.payment_reference,
          run.payroll_number,
          run.period_label,
          run.payroll_status::text AS payroll_status
        FROM payroll_run_items item
        JOIN payroll_runs run
          ON run.id=item.payroll_run_id
         AND run.school_id=item.school_id
         AND run.deleted_at IS NULL
        WHERE item.id=$1 AND item.school_id=$2 AND item.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE OF item,run
        `,
        [payrollItemId, dto.schoolId],
      );
      const item = result.rows[0];
      if (!item) {
        throw new NotFoundException('Payroll item not found for this school.');
      }
      if (item.payroll_status !== 'PROCESSING') {
        throw new ConflictException(
          'Salary payments can only be recorded while payroll is processing.',
        );
      }
      if (!['PENDING', 'REVERSED'].includes(item.payment_status)) {
        throw new ConflictException(
          `A ${item.payment_status.toLowerCase()} payroll item cannot be paid.`,
        );
      }
      const paymentMethod = dto.paymentMethod.trim().toUpperCase();
      const paymentReference = dto.paymentReference?.trim() || null;
      if (paymentMethod !== 'CASH' && !paymentReference) {
        throw new BadRequestException(
          'A payment reference is required for non-cash payroll payments.',
        );
      }
      const updatedResult = await client.query<{
        id: string;
        payment_status: string;
        paid_at: string;
        payment_method: string | null;
        payment_reference: string | null;
        notes: string | null;
      }>(
        `
        UPDATE payroll_run_items
        SET
          payment_status='PAID',
          paid_at=COALESCE($3::timestamptz,NOW()),
          payment_method=$4,
          payment_reference=$5,
          notes=COALESCE($6,notes),
          updated_at=NOW()
        WHERE id=$1 AND school_id=$2
        RETURNING
          id,
          payment_status::text AS payment_status,
          paid_at::text AS paid_at,
          payment_method,
          payment_reference,
          notes
        `,
        [
          payrollItemId,
          dto.schoolId,
          dto.paidAt || null,
          paymentMethod,
          paymentReference,
          dto.notes?.trim() || null,
        ],
      );
      const updated = updatedResult.rows[0];
      const beforeState = {
        paymentStatus: item.payment_status,
        paidAt: item.paid_at,
        paymentMethod: item.payment_method,
        paymentReference: item.payment_reference,
      };
      const afterState = {
        paymentStatus: updated.payment_status,
        paidAt: updated.paid_at,
        paymentMethod: updated.payment_method,
        paymentReference: updated.payment_reference,
      };
      await client.query(
        `
        INSERT INTO payroll_item_change_log (
          school_id,payroll_run_id,payroll_run_item_id,change_type,reason,
          before_state,after_state,actor_user_id
        )
        VALUES ($1,$2,$3,'PAYMENT_RECORDED',$4,$5::jsonb,$6::jsonb,$7)
        `,
        [
          dto.schoolId,
          item.payroll_run_id,
          payrollItemId,
          dto.notes?.trim() || null,
          JSON.stringify(beforeState),
          JSON.stringify(afterState),
          actorUserId,
        ],
      );
      const unsettledResult = await client.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM payroll_run_items
        WHERE school_id=$1 AND payroll_run_id=$2 AND deleted_at IS NULL
          AND payment_status::text <> 'PAID'
        `,
        [dto.schoolId, item.payroll_run_id],
      );
      const fullyPaid = Number(unsettledResult.rows[0]?.count ?? 0) === 0;
      if (fullyPaid) {
        await client.query(
          `
          UPDATE payroll_runs
          SET payroll_status='PAID',paid_at=NOW(),updated_at=NOW()
          WHERE id=$1 AND school_id=$2
          `,
          [item.payroll_run_id, dto.schoolId],
        );
        await this.recordRunEventTx(client, {
          schoolId: dto.schoolId,
          payrollRunId: item.payroll_run_id,
          eventType: 'STATUS_CHANGED',
          fromStatus: 'PROCESSING',
          toStatus: 'PAID',
          actorUserId,
          note: 'All payroll items have been paid.',
        });
      }
      await this.recordRunEventTx(client, {
        schoolId: dto.schoolId,
        payrollRunId: item.payroll_run_id,
        eventType: 'ITEM_PAYMENT_RECORDED',
        fromStatus: 'PROCESSING',
        toStatus: fullyPaid ? 'PAID' : 'PROCESSING',
        actorUserId,
        payload: {
          payrollItemId,
          netSalary: Number(item.net_salary),
          paymentMethod: updated.payment_method,
          paymentReference: updated.payment_reference,
        },
      });
      await this.platformActivityService.recordTx(client, {
        eventType: 'PAYROLL_ITEM_PAID',
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Salary marked paid for ${item.snapshot_full_name} in ${item.period_label}.`,
        payload: {
          payrollRunId: item.payroll_run_id,
          payrollNumber: item.payroll_number,
          payrollItemId,
          netSalary: Number(item.net_salary),
          payrollRunFullyPaid: fullyPaid,
        },
      });
      return {
        id: updated.id,
        paymentStatus: updated.payment_status,
        paidAt: updated.paid_at,
        paymentMethod: updated.payment_method,
        paymentReference: updated.payment_reference,
        notes: updated.notes,
        payrollRunFullyPaid: fullyPaid,
        payrollRunStatus: fullyPaid ? 'PAID' : 'PROCESSING',
      };
    });
  }

  async reversePayrollItemPayment(
    payrollItemId: string,
    dto: ReversePayrollItemPaymentDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actor = await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );
    this.assertCanReverse(actor);
    const reason = dto.reason.trim();
    return this.db.withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        payroll_run_id: string;
        payment_status: string;
        paid_at: string | null;
        payment_method: string | null;
        payment_reference: string | null;
        snapshot_full_name: string;
        payroll_status: string;
        payroll_number: string | null;
      }>(
        `
        SELECT
          item.id,
          item.payroll_run_id,
          item.payment_status::text AS payment_status,
          item.paid_at::text AS paid_at,
          item.payment_method,
          item.payment_reference,
          item.snapshot_full_name,
          run.payroll_status::text AS payroll_status,
          run.payroll_number
        FROM payroll_run_items item
        JOIN payroll_runs run
          ON run.id=item.payroll_run_id
         AND run.school_id=item.school_id
         AND run.deleted_at IS NULL
        WHERE item.id=$1 AND item.school_id=$2 AND item.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE OF item,run
        `,
        [payrollItemId, dto.schoolId],
      );
      const item = result.rows[0];
      if (!item) {
        throw new NotFoundException('Payroll item not found for this school.');
      }
      if (!['PROCESSING', 'PAID'].includes(item.payroll_status)) {
        throw new ConflictException(
          'Payroll payments can only be reversed before the run is closed.',
        );
      }
      if (item.payment_status !== 'PAID' || !item.paid_at) {
        throw new ConflictException(
          'Only a paid payroll item can be reversed.',
        );
      }
      const reversalResult = await client.query<ReversalRow>(
        `
        INSERT INTO payroll_payment_reversals (
          school_id,
          payroll_run_id,
          payroll_run_item_id,
          original_paid_at,
          original_payment_method,
          original_payment_reference,
          reason,
          reversed_by_user_id,
          reversed_at
        )
        VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8,NOW())
        RETURNING
          id,
          payroll_run_item_id,
          original_paid_at::text AS original_paid_at,
          original_payment_method,
          original_payment_reference,
          reason,
          reversed_by_user_id,
          reversed_at::text AS reversed_at
        `,
        [
          dto.schoolId,
          item.payroll_run_id,
          payrollItemId,
          item.paid_at,
          item.payment_method,
          item.payment_reference,
          reason,
          actorUserId,
        ],
      );
      await client.query(
        `
        UPDATE payroll_run_items
        SET payment_status='REVERSED',paid_at=NULL,payment_method=NULL,payment_reference=NULL,updated_at=NOW()
        WHERE id=$1 AND school_id=$2
        `,
        [payrollItemId, dto.schoolId],
      );
      if (item.payroll_status === 'PAID') {
        await client.query(
          `
          UPDATE payroll_runs
          SET payroll_status='PROCESSING',paid_at=NULL,updated_at=NOW()
          WHERE id=$1 AND school_id=$2
          `,
          [item.payroll_run_id, dto.schoolId],
        );
        await this.recordRunEventTx(client, {
          schoolId: dto.schoolId,
          payrollRunId: item.payroll_run_id,
          eventType: 'STATUS_CHANGED',
          fromStatus: 'PAID',
          toStatus: 'PROCESSING',
          actorUserId,
          note: reason,
          payload: { paymentReversal: true, payrollItemId },
        });
      }
      await client.query(
        `
        INSERT INTO payroll_item_change_log (
          school_id,payroll_run_id,payroll_run_item_id,change_type,reason,
          before_state,after_state,actor_user_id
        )
        VALUES ($1,$2,$3,'PAYMENT_REVERSED',$4,$5::jsonb,$6::jsonb,$7)
        `,
        [
          dto.schoolId,
          item.payroll_run_id,
          payrollItemId,
          reason,
          JSON.stringify({
            paymentStatus: 'PAID',
            paidAt: item.paid_at,
            paymentMethod: item.payment_method,
            paymentReference: item.payment_reference,
          }),
          JSON.stringify({ paymentStatus: 'REVERSED' }),
          actorUserId,
        ],
      );
      await this.recordRunEventTx(client, {
        schoolId: dto.schoolId,
        payrollRunId: item.payroll_run_id,
        eventType: 'ITEM_PAYMENT_REVERSED',
        fromStatus: item.payroll_status,
        toStatus: 'PROCESSING',
        actorUserId,
        note: reason,
        payload: { payrollItemId, reversalId: reversalResult.rows[0].id },
      });
      await this.platformActivityService.recordTx(client, {
        eventType: 'PAYROLL_ITEM_PAYMENT_REVERSED',
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Payroll payment reversed for ${item.snapshot_full_name}.`,
        payload: {
          payrollRunId: item.payroll_run_id,
          payrollNumber: item.payroll_number,
          payrollItemId,
          reversalId: reversalResult.rows[0].id,
        },
      });
      return {
        reversed: true,
        payrollRunId: item.payroll_run_id,
        payrollItemId,
        paymentStatus: 'REVERSED',
        payrollRunStatus: 'PROCESSING',
        reversal: this.mapReversal(reversalResult.rows[0]),
      };
    });
  }

  async getPayrollPaymentRegister(
    input: { schoolId: string; payrollRunId: string },
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const details = await this.getPayrollRunDetails(
      input,
      actorUserId,
      platformRole,
    );
    const entries = details.items.map((item) => ({
      payrollItemId: item.id,
      staffAccountId: item.staffAccountId,
      staffCode: item.staff.staffCode,
      fullName: item.staff.fullName,
      positionTitle: item.staff.positionTitle,
      grossSalary: item.grossSalary,
      allowances: item.allowances,
      deductions: item.deductions,
      netSalary: item.netSalary,
      paymentStatus: item.paymentStatus,
      paidAt: item.paidAt,
      paymentMethod: item.paymentMethod,
      paymentReference: item.paymentReference,
      latestReversal: item.reversals[0] ?? null,
    }));
    return {
      run: {
        id: details.run.id,
        payrollNumber: details.run.payrollNumber,
        periodLabel: details.run.periodLabel,
        periodStart: details.run.periodStart,
        periodEnd: details.run.periodEnd,
        payrollStatus: details.run.payrollStatus,
        currencyCode: details.run.currencyCode,
      },
      summary: {
        staffCount: entries.length,
        paidCount: entries.filter((entry) => entry.paymentStatus === 'PAID')
          .length,
        pendingCount: entries.filter(
          (entry) => entry.paymentStatus === 'PENDING',
        ).length,
        reversedCount: entries.filter(
          (entry) => entry.paymentStatus === 'REVERSED',
        ).length,
        totalGross: details.run.totalGross,
        totalAllowances: details.run.totalAllowances,
        totalDeductions: details.run.totalDeductions,
        totalNet: details.run.totalNet,
      },
      entries,
    };
  }

  async getPayrollPayslipDetails(
    input: { schoolId: string; payrollItemId: string },
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );
    const runResult = await this.db.query<{ payroll_run_id: string }>(
      `
      SELECT payroll_run_id
      FROM payroll_run_items
      WHERE id=$1 AND school_id=$2 AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.payrollItemId, input.schoolId],
    );
    const payrollRunId = runResult.rows[0]?.payroll_run_id;
    if (!payrollRunId) {
      throw new NotFoundException('Payroll item not found for this school.');
    }
    const [details, schoolResult] = await Promise.all([
      this.getPayrollRunDetails(
        { schoolId: input.schoolId, payrollRunId },
        actorUserId,
        platformRole,
      ),
      this.db.query<{ name: string; code: string | null }>(
        `
        SELECT name,code
        FROM schools
        WHERE id=$1 AND deleted_at IS NULL
        LIMIT 1
        `,
        [input.schoolId],
      ),
    ]);
    const item = details.items.find(
      (entry) => entry.id === input.payrollItemId,
    );
    if (!item) {
      throw new NotFoundException('Payroll item not found for this school.');
    }
    return {
      school: {
        name: schoolResult.rows[0].name,
        code: schoolResult.rows[0].code,
      },
      run: {
        id: details.run.id,
        payrollNumber: details.run.payrollNumber,
        periodLabel: details.run.periodLabel,
        periodStart: details.run.periodStart,
        periodEnd: details.run.periodEnd,
        payrollStatus: details.run.payrollStatus,
        currencyCode: details.run.currencyCode,
      },
      staff: {
        id: item.payrollStaffProfileId,
        staffAccountId: item.staffAccountId,
        ...item.staff,
      },
      item: {
        id: item.id,
        grossSalary: item.grossSalary,
        allowances: item.allowances,
        deductions: item.deductions,
        netSalary: item.netSalary,
        paymentStatus: item.paymentStatus,
        paidAt: item.paidAt,
        paymentMethod: item.paymentMethod,
        paymentReference: item.paymentReference,
        notes: item.notes,
        adjustmentLines: item.adjustmentLines,
        reversals: item.reversals,
      },
    };
  }
}
