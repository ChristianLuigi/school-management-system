import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { BootstrapSchoolSetupDto } from './dto/bootstrap-school-setup.dto';

type SchoolSetupStatusRow = {
  id: string;
  code: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
};

type CreatedGradingPeriodRow = {
  id: string;
  period_type: 'TRIMESTER';
  sequence_no: number;
  name_i18n: Record<string, string>;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type CreatedGradeLevelRow = {
  id: string;
  code: string;
  name_i18n: Record<string, string>;
};

type CreatedSectionRow = {
  id: string;
  code: string;
  name_i18n: Record<string, string>;
};

@Injectable()
export class SchoolSetupService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  async getStatus(schoolId: string) {
    const schoolResult = await this.db.query<SchoolSetupStatusRow>(
      `
      SELECT id, code, name, status
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

    const [
      levelsResult,
      academicYearsResult,
      gradingPeriodsResult,
      gradeLevelsResult,
      sectionsResult,
    ] = await Promise.all([
      this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM school_levels
        WHERE school_id = $1
          AND deleted_at IS NULL
          AND is_active = TRUE
        `,
        [schoolId],
      ),
      this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM academic_years
        WHERE school_id = $1
          AND deleted_at IS NULL
        `,
        [schoolId],
      ),
      this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM grading_periods gp
        JOIN academic_years ay ON ay.id = gp.academic_year_id
        WHERE ay.school_id = $1
          AND gp.deleted_at IS NULL
          AND ay.deleted_at IS NULL
        `,
        [schoolId],
      ),
      this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM grade_levels
        WHERE school_id = $1
          AND deleted_at IS NULL
        `,
        [schoolId],
      ),
      this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM sections
        WHERE school_id = $1
          AND deleted_at IS NULL
        `,
        [schoolId],
      ),
    ]);

    const counts = {
      levels: Number(levelsResult.rows[0]?.count ?? 0),
      academicYears: Number(academicYearsResult.rows[0]?.count ?? 0),
      gradingPeriods: Number(gradingPeriodsResult.rows[0]?.count ?? 0),
      gradeLevels: Number(gradeLevelsResult.rows[0]?.count ?? 0),
      sections: Number(sectionsResult.rows[0]?.count ?? 0),
    };

    const isComplete =
      counts.levels > 0 &&
      counts.academicYears > 0 &&
      counts.gradingPeriods > 0 &&
      school.status === 'ACTIVE';

    return {
      school,
      counts,
      checks: {
        hasLevels: counts.levels > 0,
        hasAcademicYear: counts.academicYears > 0,
        hasGradingPeriods: counts.gradingPeriods > 0,
        hasGradeLevels: counts.gradeLevels > 0,
        hasSections: counts.sections > 0,
      },
      isComplete,
    };
  }

  async bootstrap(dto: BootstrapSchoolSetupDto) {
    if (dto.academicYearEndDate < dto.academicYearStartDate) {
      throw new BadRequestException(
        'Academic year end date cannot be before start date.',
      );
    }

    for (const period of dto.gradingPeriods) {
      if (period.endDate < period.startDate) {
        throw new BadRequestException(
          `Grading period ${period.code} has an invalid date range.`,
        );
      }
    }

    return this.db.withTransaction(async (client) => {
      const school = await this.getSchoolForBootstrap(client, dto.schoolId);

      if (school.status === 'ACTIVE') {
        throw new BadRequestException(
          'School is already active. Bootstrap should not be run again.',
        );
      }

      const existingAcademicYear = await client.query<{ id: string }>(
        `
        SELECT id
        FROM academic_years
        WHERE school_id = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.schoolId],
      );

      if (existingAcademicYear.rows.length > 0) {
        throw new BadRequestException(
          'School already has academic years. Manual setup flow should be used instead.',
        );
      }

      const levels = await this.getSchoolLevelsByCode(client, dto.schoolId);

      const academicYear = await client.query<{
        id: string;
        school_id: string;
        name_i18n: Record<string, string>;
      }>(
        `
        INSERT INTO academic_years (
          school_id,
          name_i18n,
          start_date,
          end_date
        )
        VALUES ($1, $2::jsonb, $3, $4)
        RETURNING id, school_id, name_i18n
        `,
        [
          dto.schoolId,
          JSON.stringify(dto.academicYearNameI18n),
          dto.academicYearStartDate,
          dto.academicYearEndDate,
        ],
      );

      const academicYearId = academicYear.rows[0].id;

      const createdGradingPeriods: CreatedGradingPeriodRow[] = [];
      for (const period of dto.gradingPeriods) {
        const inserted = await client.query<CreatedGradingPeriodRow>(
          `
          INSERT INTO grading_periods (
            academic_year_id,
            period_type,
            sequence_no,
            name_i18n,
            start_date,
            end_date,
            is_current
          )
          VALUES ($1, 'TRIMESTER', $2, $3::jsonb, $4, $5, $6)
          RETURNING
            id,
            period_type,
            sequence_no,
            name_i18n,
            start_date,
            end_date,
            is_current
          `,
          [
            academicYearId,
            period.displayOrder,
            JSON.stringify(period.nameI18n),
            period.startDate,
            period.endDate,
            false,
          ],
        );

        createdGradingPeriods.push(inserted.rows[0]);
      }

      const createdGradeLevels: CreatedGradeLevelRow[] = [];
      const createdSections: CreatedSectionRow[] = [];

      for (const level of dto.gradeLevels ?? []) {
        const matchedSchoolLevel =
          levels[level.schoolLevelCode.trim().toUpperCase()];

        if (!matchedSchoolLevel) {
          throw new BadRequestException(
            `School level ${level.schoolLevelCode} does not exist for this school.`,
          );
        }

        const gradeLevelInsert = await client.query<{
          id: string;
          code: string;
          name_i18n: Record<string, string>;
        }>(
          `
          INSERT INTO grade_levels (
            school_id,
            school_level_id,
            code,
            name_i18n,
            display_order
          )
          VALUES ($1, $2, $3, $4::jsonb, $5)
          RETURNING id, code, name_i18n
          `,
          [
            dto.schoolId,
            matchedSchoolLevel.id,
            level.code.trim().toUpperCase(),
            JSON.stringify(level.nameI18n),
            level.displayOrder,
          ],
        );

        const gradeLevel = gradeLevelInsert.rows[0];
        createdGradeLevels.push(gradeLevel);

        for (const section of level.sections) {
          const sectionInsert = await client.query<{
            id: string;
            code: string;
            name_i18n: Record<string, string>;
          }>(
            `
            INSERT INTO sections (
              school_id,
              academic_year_id,
              grade_level_id,
              code,
              name_i18n
            )
            VALUES ($1, $2, $3, $4, $5::jsonb)
            RETURNING id, code, name_i18n
            `,
            [
              dto.schoolId,
              academicYearId,
              gradeLevel.id,
              section.code.trim().toUpperCase(),
              JSON.stringify(section.nameI18n),
            ],
          );

          createdSections.push(sectionInsert.rows[0]);
        }
      }

      const schoolUpdate = await client.query(
        `
        UPDATE schools
        SET
          status = 'ACTIVE',
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, code, name, status
        `,
        [dto.schoolId],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'SCHOOL_SETUP_COMPLETED',
        actorType: 'SCHOOL_ADMIN',
        schoolId: dto.schoolId,
        summary: 'Initial school setup was completed.',
        payload: {
          academicYearStartDate: dto.academicYearStartDate,
          academicYearEndDate: dto.academicYearEndDate,
        },
      });

      return {
        school: schoolUpdate.rows[0],
        academicYear: academicYear.rows[0],
        gradingPeriods: createdGradingPeriods,
        gradeLevels: createdGradeLevels,
        sections: createdSections,
      };
    });
  }

  private async getSchoolForBootstrap(client: PoolClient, schoolId: string) {
    const result = await client.query<SchoolSetupStatusRow>(
      `
      SELECT id, code, name, status
      FROM schools
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId],
    );

    const school = result.rows[0];

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found.`);
    }

    return school;
  }

  private async getSchoolLevelsByCode(client: PoolClient, schoolId: string) {
    const result = await client.query<{
      id: string;
      code: string;
      name_i18n: Record<string, string>;
    }>(
      `
      SELECT id, code, name_i18n
      FROM school_levels
      WHERE school_id = $1
        AND deleted_at IS NULL
        AND is_active = TRUE
      `,
      [schoolId],
    );

    return Object.fromEntries(result.rows.map((row) => [row.code, row]));
  }
}
