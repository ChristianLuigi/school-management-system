import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreatePayrollProfileDto } from '../finance-operations/dto/create-payroll-profile.dto';
import { CreatePayrollRunDto } from '../finance-operations/dto/create-payroll-run.dto';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { MarkPayrollItemPaidDto } from './dto/mark-payroll-item-paid.dto';

@Injectable()
export class FinancePayrollService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  private async assertUserCanAccessFinance(
    actorUserId: string,
    schoolId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const schoolResult = await this.db.query<{
      id: string;
      management_mode: 'SELF_MANAGED' | 'SUPERADMIN_MANAGED' | 'HYBRID_MANAGED';
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

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found.`);
    }

    if (
      platformRole === 'SUPER_ADMIN' &&
      school.management_mode !== 'SELF_MANAGED'
    ) {
      return;
    }

    const membershipResult = await this.db.query<{
      role: string;
    }>(
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
      `,
      [actorUserId, schoolId],
    );

    const roles = membershipResult.rows.map((row) => row.role);

    if (!roles.includes('SCHOOL_ADMIN') && !roles.includes('FINANCE_ADMIN')) {
      throw new ForbiddenException(
        'You do not have permission to access finance operations.',
      );
    }
  }

  async listPayrollProfiles(
    query: {
      schoolId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      query.schoolId,
      platformRole,
    );

    const result = await this.db.query<{
      id: string;
      full_name: string;
      job_title: string | null;
      base_salary: string;
      currency_code: string;
      payroll_active: boolean;
      notes: string | null;
      created_at: string;
    }>(
      `
      SELECT
        id,
        full_name,
        job_title,
        base_salary::text AS base_salary,
        currency_code,
        payroll_active,
        notes,
        created_at::text AS created_at
      FROM payroll_staff_profiles
      WHERE school_id = $1
        AND deleted_at IS NULL
      ORDER BY payroll_active DESC, full_name ASC
      LIMIT 100
      `,
      [query.schoolId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      jobTitle: row.job_title,
      baseSalary: Number(row.base_salary),
      currencyCode: row.currency_code,
      payrollActive: row.payroll_active,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  }

  async createPayrollProfile(
    dto: CreatePayrollProfileDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );

    const fullName = dto.fullName.trim();
    const baseSalary = Number(dto.baseSalary);

    if (!fullName) {
      throw new BadRequestException('Staff name is required.');
    }

    if (!Number.isFinite(baseSalary) || baseSalary < 0) {
      throw new BadRequestException('Base salary must be zero or greater.');
    }

    const currencyCode = dto.currencyCode?.trim().toUpperCase() || 'USD';

    const result = await this.db.query<{
      id: string;
      full_name: string;
      job_title: string | null;
      base_salary: string;
      currency_code: string;
      payroll_active: boolean;
      notes: string | null;
      created_at: string;
    }>(
      `
      INSERT INTO payroll_staff_profiles (
        school_id,
        full_name,
        job_title,
        base_salary,
        currency_code,
        payroll_active,
        notes,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        full_name,
        job_title,
        base_salary::text AS base_salary,
        currency_code,
        payroll_active,
        notes,
        created_at::text AS created_at
      `,
      [
        dto.schoolId,
        fullName,
        dto.jobTitle?.trim() || null,
        baseSalary,
        currencyCode,
        dto.payrollActive ?? true,
        dto.notes?.trim() || null,
        actorUserId,
      ],
    );

    const row = result.rows[0];

    await this.platformActivityService.record({
      eventType: 'PAYROLL_PROFILE_CREATED',
      actorType: platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
      actorUserId,
      schoolId: dto.schoolId,
      summary: `Payroll profile created for ${fullName}.`,
      payload: {
        payrollStaffProfileId: row.id,
        fullName,
        baseSalary,
        currencyCode,
      },
    });

    return {
      id: row.id,
      fullName: row.full_name,
      jobTitle: row.job_title,
      baseSalary: Number(row.base_salary),
      currencyCode: row.currency_code,
      payrollActive: row.payroll_active,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }

  async listPayrollRuns(
    query: {
      schoolId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      query.schoolId,
      platformRole,
    );

    const result = await this.db.query<{
      id: string;
      payroll_number: string | null;
      period_label: string;
      period_start: string | null;
      period_end: string | null;
      payroll_status: string;
      currency_code: string;
      total_gross: string;
      total_allowances: string;
      total_deductions: string;
      total_net: string;
      created_at: string;
    }>(
      `
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
        created_at::text AS created_at
      FROM payroll_runs
      WHERE school_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [query.schoolId],
    );

    return result.rows.map((row) => ({
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
      createdAt: row.created_at,
    }));
  }

  async createPayrollRun(
    dto: CreatePayrollRunDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );

    const periodLabel = dto.periodLabel.trim();

    if (!periodLabel) {
      throw new BadRequestException('Payroll period label is required.');
    }

    return this.db.withTransaction(async (client) => {
      const activeProfilesResult = await client.query<{
        id: string;
        full_name: string;
        base_salary: string;
        currency_code: string;
      }>(
        `
        SELECT
          id,
          full_name,
          base_salary::text AS base_salary,
          currency_code
        FROM payroll_staff_profiles
        WHERE school_id = $1
          AND payroll_active = TRUE
          AND deleted_at IS NULL
        ORDER BY full_name ASC
        `,
        [dto.schoolId],
      );

      if (activeProfilesResult.rows.length === 0) {
        throw new BadRequestException(
          'No active payroll staff profiles found. Create staff salary profiles first.',
        );
      }

      const payrollNumberResult = await client.query<{
        payroll_number: string;
      }>(
        `
        SELECT next_payroll_number($1) AS payroll_number
        `,
        [dto.schoolId],
      );

      const payrollNumber = payrollNumberResult.rows[0].payroll_number;
      const currencyCode = dto.currencyCode?.trim().toUpperCase() || 'USD';

      const payrollRunResult = await client.query<{
        id: string;
        payroll_status: string;
        period_start: string | null;
        period_end: string | null;
        created_at: string;
      }>(
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
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4::date, $5::date, 'DRAFT', $6, $7, $8)
        RETURNING
          id,
          payroll_status::text AS payroll_status,
          period_start::text AS period_start,
          period_end::text AS period_end,
          created_at::text AS created_at
        `,
        [
          dto.schoolId,
          payrollNumber,
          periodLabel,
          dto.periodStart || null,
          dto.periodEnd || null,
          currencyCode,
          dto.notes?.trim() || null,
          actorUserId,
        ],
      );

      const payrollRun = payrollRunResult.rows[0];

      let totalGross = 0;
      let totalAllowances = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      for (const profile of activeProfilesResult.rows) {
        const grossSalary = Number(profile.base_salary);
        const allowances = 0;
        const deductions = 0;
        const netSalary = grossSalary + allowances - deductions;

        totalGross += grossSalary;
        totalAllowances += allowances;
        totalDeductions += deductions;
        totalNet += netSalary;

        await client.query(
          `
          INSERT INTO payroll_run_items (
            school_id,
            payroll_run_id,
            payroll_staff_profile_id,
            gross_salary,
            allowances,
            deductions,
            net_salary,
            payment_status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
          `,
          [
            dto.schoolId,
            payrollRun.id,
            profile.id,
            grossSalary,
            allowances,
            deductions,
            netSalary,
          ],
        );
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
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        `,
        [
          payrollRun.id,
          dto.schoolId,
          totalGross,
          totalAllowances,
          totalDeductions,
          totalNet,
        ],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'PAYROLL_RUN_CREATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Payroll run ${payrollNumber} created for ${periodLabel}.`,
        payload: {
          payrollRunId: payrollRun.id,
          payrollNumber,
          periodLabel,
          staffCount: activeProfilesResult.rows.length,
          totalGross,
          totalAllowances,
          totalDeductions,
          totalNet,
          currencyCode,
        },
      });

      return {
        id: payrollRun.id,
        payrollNumber,
        periodLabel,
        periodStart: payrollRun.period_start,
        periodEnd: payrollRun.period_end,
        payrollStatus: payrollRun.payroll_status,
        currencyCode,
        totalGross,
        totalAllowances,
        totalDeductions,
        totalNet,
        staffCount: activeProfilesResult.rows.length,
        createdAt: payrollRun.created_at,
      };
    });
  }
  async getPayrollRunDetails(
    input: {
      schoolId: string;
      payrollRunId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const runResult = await this.db.query<{
      id: string;
      payroll_number: string | null;
      period_label: string;
      period_start: string | null;
      period_end: string | null;
      payroll_status: string;
      currency_code: string;
      total_gross: string;
      total_allowances: string;
      total_deductions: string;
      total_net: string;
      notes: string | null;
      created_at: string;
    }>(
      `
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
        created_at::text AS created_at
      FROM payroll_runs
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.payrollRunId, input.schoolId],
    );

    const run = runResult.rows[0];

    if (!run) {
      throw new NotFoundException('Payroll run not found for this school.');
    }

    const itemsResult = await this.db.query<{
      id: string;
      payroll_staff_profile_id: string;
      gross_salary: string;
      allowances: string;
      deductions: string;
      net_salary: string;
      payment_status: string;
      paid_at: string | null;
      payment_method: string | null;
      payment_reference: string | null;
      notes: string | null;
      full_name: string;
      staff_code: string | null;
      position_title: string | null;
      department: string | null;
      employment_type: string;
      pay_frequency: string;
      currency_code: string;
    }>(
      `
      SELECT
        item.id,
        item.payroll_staff_profile_id,
        item.gross_salary::text AS gross_salary,
        item.allowances::text AS allowances,
        item.deductions::text AS deductions,
        item.net_salary::text AS net_salary,
        item.payment_status::text AS payment_status,
        item.paid_at::text AS paid_at,
        item.payment_method,
        item.payment_reference,
        item.notes,
        profile.full_name,
        profile.staff_code,
        COALESCE(profile.position_title, profile.job_title) AS position_title,
        profile.department,
        profile.employment_type,
        profile.pay_frequency,
        profile.currency_code
      FROM payroll_run_items item
      JOIN payroll_staff_profiles profile
        ON profile.id = item.payroll_staff_profile_id
       AND profile.deleted_at IS NULL
      WHERE item.school_id = $1
        AND item.payroll_run_id = $2
        AND item.deleted_at IS NULL
      ORDER BY profile.full_name ASC
      `,
      [input.schoolId, input.payrollRunId],
    );

    const items = itemsResult.rows.map((row) => ({
      id: row.id,
      payrollStaffProfileId: row.payroll_staff_profile_id,
      grossSalary: Number(row.gross_salary),
      allowances: Number(row.allowances),
      deductions: Number(row.deductions),
      netSalary: Number(row.net_salary),
      paymentStatus: row.payment_status,
      paidAt: row.paid_at,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      notes: row.notes,
      staff: {
        fullName: row.full_name,
        staffCode: row.staff_code,
        positionTitle: row.position_title,
        department: row.department,
        employmentType: row.employment_type,
        payFrequency: row.pay_frequency,
        currencyCode: row.currency_code,
      },
    }));

    return {
      run: {
        id: run.id,
        payrollNumber: run.payroll_number,
        periodLabel: run.period_label,
        periodStart: run.period_start,
        periodEnd: run.period_end,
        payrollStatus: run.payroll_status,
        currencyCode: run.currency_code,
        totalGross: Number(run.total_gross),
        totalAllowances: Number(run.total_allowances),
        totalDeductions: Number(run.total_deductions),
        totalNet: Number(run.total_net),
        notes: run.notes,
        createdAt: run.created_at,
      },
      items,
    };
  }

  async markPayrollItemPaid(
    payrollItemId: string,
    dto: MarkPayrollItemPaidDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );

    return this.db.withTransaction(async (client) => {
      const itemResult = await client.query<{
        id: string;
        payroll_run_id: string;
        payment_status: string;
        net_salary: string;
        full_name: string;
        payroll_number: string | null;
        period_label: string;
      }>(
        `
        SELECT
          item.id,
          item.payroll_run_id,
          item.payment_status::text AS payment_status,
          item.net_salary::text AS net_salary,
          profile.full_name,
          run.payroll_number,
          run.period_label
        FROM payroll_run_items item
        JOIN payroll_staff_profiles profile
          ON profile.id = item.payroll_staff_profile_id
         AND profile.deleted_at IS NULL
        JOIN payroll_runs run
          ON run.id = item.payroll_run_id
         AND run.deleted_at IS NULL
        WHERE item.id = $1
          AND item.school_id = $2
          AND item.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [payrollItemId, dto.schoolId],
      );

      const item = itemResult.rows[0];

      if (!item) {
        throw new NotFoundException('Payroll item not found for this school.');
      }

      if (item.payment_status === 'CANCELLED') {
        throw new BadRequestException(
          'Cannot mark a cancelled payroll item as paid.',
        );
      }

      const updatedItemResult = await client.query<{
        id: string;
        payment_status: string;
        paid_at: string | null;
        payment_method: string | null;
        payment_reference: string | null;
        notes: string | null;
      }>(
        `
        UPDATE payroll_run_items
        SET
          payment_status = 'PAID',
          paid_at = COALESCE($3::timestamptz, NOW()),
          payment_method = $4,
          payment_reference = $5,
          notes = COALESCE($6, notes),
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
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
          dto.paymentMethod?.trim() || null,
          dto.paymentReference?.trim() || null,
          dto.notes?.trim() || null,
        ],
      );

      const updatedItem = updatedItemResult.rows[0];

      const pendingItemsResult = await client.query<{
        count: string;
      }>(
        `
        SELECT COUNT(*)::text AS count
        FROM payroll_run_items
        WHERE payroll_run_id = $1
          AND school_id = $2
          AND deleted_at IS NULL
          AND payment_status = 'PENDING'
        `,
        [item.payroll_run_id, dto.schoolId],
      );

      const pendingCount = Number(pendingItemsResult.rows[0].count);

      if (pendingCount === 0) {
        await client.query(
          `
          UPDATE payroll_runs
          SET
            payroll_status = 'PAID',
            updated_at = NOW()
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          `,
          [item.payroll_run_id, dto.schoolId],
        );
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'PAYROLL_ITEM_PAID',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Salary marked paid for ${item.full_name} in ${item.period_label}.`,
        payload: {
          payrollRunId: item.payroll_run_id,
          payrollNumber: item.payroll_number,
          payrollItemId,
          fullName: item.full_name,
          netSalary: Number(item.net_salary),
          paymentMethod: updatedItem.payment_method,
          paymentReference: updatedItem.payment_reference,
          payrollRunFullyPaid: pendingCount === 0,
        },
      });

      return {
        id: updatedItem.id,
        paymentStatus: updatedItem.payment_status,
        paidAt: updatedItem.paid_at,
        paymentMethod: updatedItem.payment_method,
        paymentReference: updatedItem.payment_reference,
        notes: updatedItem.notes,
        payrollRunFullyPaid: pendingCount === 0,
      };
    });
  }
  async getPayrollPayslipDetails(
    input: {
      schoolId: string;
      payrollItemId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const result = await this.db.query<{
      item_id: string;
      gross_salary: string;
      allowances: string;
      deductions: string;
      net_salary: string;
      payment_status: string;
      paid_at: string | null;
      payment_method: string | null;
      payment_reference: string | null;
      item_notes: string | null;
      payroll_run_id: string;
      payroll_number: string | null;
      period_label: string;
      period_start: string | null;
      period_end: string | null;
      payroll_status: string;
      currency_code: string;
      staff_profile_id: string;
      staff_code: string | null;
      full_name: string;
      position_title: string | null;
      department: string | null;
      employment_type: string;
      pay_frequency: string;
      school_name: string;
      school_code: string | null;
    }>(
      `
      SELECT
        item.id AS item_id,
        item.gross_salary::text AS gross_salary,
        item.allowances::text AS allowances,
        item.deductions::text AS deductions,
        item.net_salary::text AS net_salary,
        item.payment_status::text AS payment_status,
        item.paid_at::text AS paid_at,
        item.payment_method,
        item.payment_reference,
        item.notes AS item_notes,
        run.id AS payroll_run_id,
        run.payroll_number,
        run.period_label,
        run.period_start::text AS period_start,
        run.period_end::text AS period_end,
        run.payroll_status::text AS payroll_status,
        run.currency_code,
        profile.id AS staff_profile_id,
        profile.staff_code,
        profile.full_name,
        COALESCE(profile.position_title, profile.job_title) AS position_title,
        profile.department,
        profile.employment_type,
        profile.pay_frequency,
        sc.name AS school_name,
        sc.code AS school_code
      FROM payroll_run_items item
      JOIN payroll_runs run
        ON run.id = item.payroll_run_id
       AND run.deleted_at IS NULL
      JOIN payroll_staff_profiles profile
        ON profile.id = item.payroll_staff_profile_id
       AND profile.deleted_at IS NULL
      JOIN schools sc
        ON sc.id = item.school_id
       AND sc.deleted_at IS NULL
      WHERE item.id = $1
        AND item.school_id = $2
        AND item.deleted_at IS NULL
      LIMIT 1
      `,
      [input.payrollItemId, input.schoolId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException('Payroll item not found for this school.');
    }

    return {
      school: {
        name: row.school_name,
        code: row.school_code,
      },
      run: {
        id: row.payroll_run_id,
        payrollNumber: row.payroll_number,
        periodLabel: row.period_label,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        payrollStatus: row.payroll_status,
        currencyCode: row.currency_code,
      },
      staff: {
        id: row.staff_profile_id,
        staffCode: row.staff_code,
        fullName: row.full_name,
        positionTitle: row.position_title,
        department: row.department,
        employmentType: row.employment_type,
        payFrequency: row.pay_frequency,
      },
      item: {
        id: row.item_id,
        grossSalary: Number(row.gross_salary),
        allowances: Number(row.allowances),
        deductions: Number(row.deductions),
        netSalary: Number(row.net_salary),
        paymentStatus: row.payment_status,
        paidAt: row.paid_at,
        paymentMethod: row.payment_method,
        paymentReference: row.payment_reference,
        notes: row.item_notes,
      },
    };
  }
}
