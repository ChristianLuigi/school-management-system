import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { hashPassword } from '../internal-auth/password.util';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { CreatePlatformSchoolDto } from './dto/create-platform-school.dto';
import { CreateSchoolStaffDto } from './dto/create-school-staff.dto';
import { UpdatePlatformSchoolDto } from './dto/update-platform-school.dto';

type ManagementMode = 'SELF_MANAGED' | 'SUPERADMIN_MANAGED' | 'HYBRID_MANAGED';

type SchoolRow = {
  id: string;
  code: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  management_mode: ManagementMode;
  default_locale: 'fr' | 'en';
  supported_locales: string[];
  timezone: string;
  currency_code: string;
  country_code: string;
  created_at: string;
  updated_at: string;
};

type SchoolLevelRow = {
  id: string;
  school_id: string;
  code: string;
  name_i18n: Record<string, string>;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

type StaffRow = {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  user_status: string;
  membership_id: string;
  membership_status: string;
  roles: string[];
};

@Injectable()
export class PlatformSchoolsService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  async findAll(): Promise<SchoolRow[]> {
    const result = await this.db.query<SchoolRow>(
      `
      SELECT
        id,
        code,
        name,
        status,
        management_mode,
        default_locale,
        supported_locales,
        timezone,
        currency_code,
        country_code,
        created_at,
        updated_at
      FROM schools
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      `,
    );

    return result.rows;
  }

  async findOne(id: string) {
    const schoolResult = await this.db.query<SchoolRow>(
      `
      SELECT
        s.id,
        s.code,
        s.name,
        s.status,
        s.management_mode,
        s.default_locale,
        s.supported_locales,
        s.timezone,
        s.currency_code,
        s.country_code,
        s.created_at,
        s.updated_at
      FROM schools s
      WHERE s.id = $1
        AND s.deleted_at IS NULL
      LIMIT 1
      `,
      [id],
    );

    const school = schoolResult.rows[0];

    if (!school) {
      throw new NotFoundException(`School ${id} not found.`);
    }

    const [setupCounts, staffCounts] = await Promise.all([
      this.db.query<{
        levels: string;
        academic_years: string;
        grading_periods: string;
        grade_levels: string;
        sections: string;
      }>(
        `
        SELECT
          (SELECT COUNT(*)::text
           FROM school_levels sl
           WHERE sl.school_id = $1
             AND sl.deleted_at IS NULL
             AND sl.is_active = TRUE) AS levels,
          (SELECT COUNT(*)::text
           FROM academic_years ay
           WHERE ay.school_id = $1
             AND ay.deleted_at IS NULL) AS academic_years,
          (SELECT COUNT(*)::text
           FROM grading_periods gp
           JOIN academic_years ay ON ay.id = gp.academic_year_id
           WHERE ay.school_id = $1
             AND gp.deleted_at IS NULL
             AND ay.deleted_at IS NULL) AS grading_periods,
          (SELECT COUNT(*)::text
           FROM grade_levels gl
           WHERE gl.school_id = $1
             AND gl.deleted_at IS NULL) AS grade_levels,
          (SELECT COUNT(*)::text
           FROM sections se
           WHERE se.school_id = $1
             AND se.deleted_at IS NULL) AS sections
        `,
        [id],
      ),
      this.db.query<{
        school_admins: string;
        teachers: string;
        finance_admins: string;
        total_staff: string;
      }>(
        `
        SELECT
          COUNT(*) FILTER (WHERE smr.role = 'SCHOOL_ADMIN')::text AS school_admins,
          COUNT(*) FILTER (WHERE smr.role = 'TEACHER')::text AS teachers,
          COUNT(*) FILTER (WHERE smr.role = 'FINANCE_ADMIN')::text AS finance_admins,
          COUNT(DISTINCT sm.user_id)::text AS total_staff
        FROM school_memberships sm
        LEFT JOIN school_membership_roles smr
          ON smr.school_membership_id = sm.id
         AND smr.deleted_at IS NULL
        WHERE sm.school_id = $1
          AND sm.deleted_at IS NULL
          AND sm.membership_status = 'ACTIVE'
        `,
        [id],
      ),
    ]);

    const setup = setupCounts.rows[0];
    const staff = staffCounts.rows[0];

    return {
      school,
      setup: {
        levels: Number(setup?.levels ?? 0),
        academicYears: Number(setup?.academic_years ?? 0),
        gradingPeriods: Number(setup?.grading_periods ?? 0),
        gradeLevels: Number(setup?.grade_levels ?? 0),
        sections: Number(setup?.sections ?? 0),
      },
      staff: {
        schoolAdmins: Number(staff?.school_admins ?? 0),
        teachers: Number(staff?.teachers ?? 0),
        financeAdmins: Number(staff?.finance_admins ?? 0),
        totalStaff: Number(staff?.total_staff ?? 0),
      },
    };
  }

  async create(dto: CreatePlatformSchoolDto) {
    return this.db.withTransaction(async (client) => {
      const uniqueLevelCodes = [...new Set(dto.initialLevels)];

      if (uniqueLevelCodes.length !== dto.initialLevels.length) {
        throw new BadRequestException('Initial levels contain duplicates.');
      }

      const generatedCode = await this.generateCode(client, uniqueLevelCodes);

      const school = await this.insertSchool(client, {
        code: generatedCode,
        name: dto.name.trim(),
        managementMode: dto.managementMode ?? 'SELF_MANAGED',
        defaultLocale: dto.defaultLocale,
        timezone: dto.timezone.trim(),
        currencyCode: dto.currencyCode.trim().toUpperCase(),
        countryCode: dto.countryCode.trim().toUpperCase(),
      });

      const levels = await this.insertInitialLevels(
        client,
        school.id,
        uniqueLevelCodes,
      );

      const firstAdmin = await this.upsertUserWithRole(client, {
        schoolId: school.id,
        email: dto.firstAdmin.email.trim().toLowerCase(),
        temporaryPassword: dto.firstAdmin.temporaryPassword,
        firstName: dto.firstAdmin.firstName?.trim() ?? null,
        lastName: dto.firstAdmin.lastName?.trim() ?? null,
        role: 'SCHOOL_ADMIN',
      });

      await this.platformActivityService.recordTx(client, {
        eventType: 'SCHOOL_CREATED',
        actorType: 'SUPERADMIN',
        schoolId: school.id,
        summary: `School ${school.name} (${school.code}) was created.`,
        payload: {
          schoolCode: school.code,
          managementMode:
            school.management_mode ?? dto.managementMode ?? 'SELF_MANAGED',
        },
      });

      return { school, levels, firstAdmin };
    });
  }

  async update(id: string, dto: UpdatePlatformSchoolDto): Promise<SchoolRow> {
    const result = await this.db.query<SchoolRow>(
      `
      UPDATE schools
      SET
        name = COALESCE($2, name),
        default_locale = COALESCE($3, default_locale),
        timezone = COALESCE($4, timezone),
        currency_code = COALESCE($5, currency_code),
        country_code = COALESCE($6, country_code),
        management_mode = COALESCE($7::school_management_mode, management_mode),
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING
        id,
        code,
        name,
        status,
        management_mode,
        default_locale,
        supported_locales,
        timezone,
        currency_code,
        country_code,
        created_at,
        updated_at
      `,
      [
        id,
        dto.name?.trim() || null,
        dto.defaultLocale ?? null,
        dto.timezone?.trim() || null,
        dto.currencyCode?.trim().toUpperCase() || null,
        dto.countryCode?.trim().toUpperCase() || null,
        dto.managementMode ?? null,
      ],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`School ${id} not found.`);
    }

    await this.platformActivityService.record({
      eventType: dto.managementMode
        ? 'SCHOOL_MANAGEMENT_MODE_CHANGED'
        : 'SCHOOL_UPDATED',
      actorType: 'SUPERADMIN',
      schoolId: id,
      summary: dto.managementMode
        ? 'School management mode was updated.'
        : 'School settings were updated.',
      payload: dto as unknown as Record<string, unknown>,
    });

    return result.rows[0];
  }

  async activate(id: string) {
    const school = await this.setStatus(id, 'ACTIVE');
    await this.recordSchoolStatusChange(id, 'ACTIVE');
    return school;
  }

  async suspend(id: string) {
    const school = await this.setStatus(id, 'SUSPENDED');
    await this.recordSchoolStatusChange(id, 'SUSPENDED');
    return school;
  }

  async archive(id: string) {
    const school = await this.setStatus(id, 'ARCHIVED');
    await this.recordSchoolStatusChange(id, 'ARCHIVED');
    return school;
  }

  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
  ): Promise<SchoolRow> {
    const school = await this.setStatus(id, status);
    await this.recordSchoolStatusChange(id, status);
    return school;
  }

  async softDelete(id: string): Promise<void> {
    const result = await this.db.query(
      `
      UPDATE schools
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [id],
    );

    if (result.rowCount === 0) {
      throw new BadRequestException('School not found.');
    }
  }

  async findSchoolStaff(schoolId: string): Promise<StaffRow[]> {
    const schoolCheck = await this.db.query(
      `SELECT id FROM schools WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [schoolId],
    );

    if (schoolCheck.rows.length === 0) {
      throw new NotFoundException('School not found.');
    }

    const result = await this.db.query<StaffRow>(
      `
      SELECT
        u.id          AS user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.status      AS user_status,
        sm.id         AS membership_id,
        sm.membership_status,
        COALESCE(
          ARRAY_AGG(smr.role ORDER BY smr.role) FILTER (WHERE smr.deleted_at IS NULL),
          ARRAY[]::school_staff_role[]
        ) AS roles
      FROM school_memberships sm
      JOIN users u ON u.id = sm.user_id
      LEFT JOIN school_membership_roles smr ON smr.school_membership_id = sm.id
      WHERE sm.school_id = $1
        AND sm.deleted_at IS NULL
        AND u.deleted_at IS NULL
      GROUP BY
        u.id, u.email, u.first_name, u.last_name, u.status,
        sm.id, sm.membership_status
      ORDER BY u.last_name ASC NULLS LAST, u.first_name ASC NULLS LAST
      `,
      [schoolId],
    );

    return result.rows;
  }

  async createSchoolStaff(schoolId: string, dto: CreateSchoolStaffDto) {
    const schoolCheck = await this.db.query(
      `SELECT id FROM schools WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [schoolId],
    );

    if (schoolCheck.rows.length === 0) {
      throw new NotFoundException('School not found.');
    }

    return this.db.withTransaction(async (client) => {
      return this.upsertUserWithRole(client, {
        schoolId,
        email: dto.email.trim().toLowerCase(),
        temporaryPassword: dto.temporaryPassword,
        firstName: dto.firstName?.trim() ?? null,
        lastName: dto.lastName?.trim() ?? null,
        role: dto.role,
      });
    });
  }

  private async recordSchoolStatusChange(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
  ): Promise<void> {
    const eventType =
      status === 'ACTIVE'
        ? 'SCHOOL_ACTIVATED'
        : status === 'SUSPENDED'
          ? 'SCHOOL_SUSPENDED'
          : 'SCHOOL_ARCHIVED';

    const summary =
      status === 'ACTIVE'
        ? 'School was activated.'
        : status === 'SUSPENDED'
          ? 'School was suspended.'
          : 'School was archived.';

    await this.platformActivityService.record({
      eventType,
      actorType: 'SUPERADMIN',
      schoolId: id,
      summary,
      payload: {},
    });
  }

  private async setStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
  ): Promise<SchoolRow> {
    const result = await this.db.query<SchoolRow>(
      `
      UPDATE schools
      SET
        status = $2,
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING
        id,
        code,
        name,
        status,
        management_mode,
        default_locale,
        supported_locales,
        timezone,
        currency_code,
        country_code,
        created_at,
        updated_at
      `,
      [id, status],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`School ${id} not found.`);
    }

    return result.rows[0];
  }

  private async upsertUserWithRole(
    client: PoolClient,
    input: {
      schoolId: string;
      email: string;
      temporaryPassword: string;
      firstName: string | null;
      lastName: string | null;
      role: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';
    },
  ): Promise<UserRow> {
    const passwordHash = hashPassword(input.temporaryPassword);

    const userResult = await client.query<UserRow>(
      `
      INSERT INTO users (email, password_hash, preferred_locale, status, first_name, last_name)
      VALUES ($1, $2, 'fr', 'ACTIVE', $3, $4)
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            status        = 'ACTIVE',
            first_name    = COALESCE(users.first_name, EXCLUDED.first_name),
            last_name     = COALESCE(users.last_name,  EXCLUDED.last_name),
            updated_at    = NOW()
      RETURNING id, email, first_name, last_name
      `,
      [input.email, passwordHash, input.firstName, input.lastName],
    );

    const user = userResult.rows[0];

    const existingMembership = await client.query<{ id: string }>(
      `
      SELECT id FROM school_memberships
      WHERE school_id = $1 AND user_id = $2 AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.schoolId, user.id],
    );

    let membershipId: string;

    if (existingMembership.rows.length > 0) {
      membershipId = existingMembership.rows[0].id;
      await client.query(
        `
        UPDATE school_memberships
        SET membership_status = 'ACTIVE',
            activated_at      = NOW(),
            updated_at        = NOW()
        WHERE id = $1
        `,
        [membershipId],
      );
    } else {
      const inserted = await client.query<{ id: string }>(
        `
        INSERT INTO school_memberships
          (school_id, user_id, membership_status, invited_at, joined_at, activated_at, is_primary)
        VALUES ($1, $2, 'ACTIVE', NOW(), NOW(), NOW(), TRUE)
        RETURNING id
        `,
        [input.schoolId, user.id],
      );
      membershipId = inserted.rows[0].id;
    }

    await client.query(
      `
      INSERT INTO school_membership_roles (school_membership_id, role)
      VALUES ($1, $2::school_staff_role)
      ON CONFLICT DO NOTHING
      `,
      [membershipId, input.role],
    );

    await client.query(
      `
      INSERT INTO school_user_roles (school_id, user_id, role, is_primary)
      VALUES ($1, $2, $3::school_role, TRUE)
      ON CONFLICT (school_id, user_id, role) DO NOTHING
      `,
      [input.schoolId, user.id, input.role],
    );

    return user;
  }

  private buildTypePrefix(levels: Array<'KG' | 'PRIM' | 'SEC'>): string {
    const order: Record<string, number> = { KG: 0, PRIM: 1, SEC: 2 };
    const sorted = [...new Set(levels)].sort((a, b) => order[a] - order[b]);
    return sorted
      .map((l) => (l === 'KG' ? 'K' : l === 'PRIM' ? 'P' : 'S'))
      .join('');
  }

  private async generateCode(
    client: PoolClient,
    levels: Array<'KG' | 'PRIM' | 'SEC'>,
  ): Promise<string> {
    const prefix = this.buildTypePrefix(levels);
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM schools WHERE code LIKE $1`,
      [`${prefix}-%`],
    );
    const next = Number(result.rows[0].count) + 1;
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }

  private async insertSchool(
    client: PoolClient,
    input: {
      code: string;
      name: string;
      managementMode: ManagementMode;
      defaultLocale: 'fr' | 'en';
      timezone: string;
      currencyCode: string;
      countryCode: string;
    },
  ): Promise<SchoolRow> {
    const result = await client.query<SchoolRow>(
      `
      INSERT INTO schools (
        code,
        name,
        status,
        management_mode,
        default_locale,
        supported_locales,
        timezone,
        currency_code,
        country_code
      )
      VALUES (
        $1,
        $2,
        'ACTIVE_SETUP',
        $3::school_management_mode,
        $4,
        '["fr","en"]'::jsonb,
        $5,
        $6,
        $7
      )
      RETURNING
        id,
        code,
        name,
        status,
        management_mode,
        default_locale,
        supported_locales,
        timezone,
        currency_code,
        country_code,
        created_at,
        updated_at
      `,
      [
        input.code,
        input.name,
        input.managementMode,
        input.defaultLocale,
        input.timezone,
        input.currencyCode,
        input.countryCode,
      ],
    );

    return result.rows[0];
  }

  private async insertInitialLevels(
    client: PoolClient,
    schoolId: string,
    levelCodes: Array<'KG' | 'PRIM' | 'SEC'>,
  ): Promise<SchoolLevelRow[]> {
    const levelDefinitions: Record<
      'KG' | 'PRIM' | 'SEC',
      { nameI18n: Record<string, string>; displayOrder: number }
    > = {
      KG: {
        nameI18n: { fr: 'Maternelle', en: 'Kindergarten' },
        displayOrder: 1,
      },
      PRIM: {
        nameI18n: { fr: 'Fondamental', en: 'Primary' },
        displayOrder: 2,
      },
      SEC: {
        nameI18n: { fr: 'Secondaire', en: 'Secondary' },
        displayOrder: 3,
      },
    };

    const rows: SchoolLevelRow[] = [];

    for (const code of levelCodes) {
      const def = levelDefinitions[code];
      const result = await client.query<SchoolLevelRow>(
        `
        INSERT INTO school_levels (school_id, code, name_i18n, display_order, is_active)
        VALUES ($1, $2, $3::jsonb, $4, TRUE)
        RETURNING id, school_id, code, name_i18n, display_order, is_active, created_at, updated_at
        `,
        [schoolId, code, JSON.stringify(def.nameI18n), def.displayOrder],
      );
      rows.push(result.rows[0]);
    }

    return rows.sort((a, b) => a.display_order - b.display_order);
  }
}
