import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { UpdateSchoolBrandingDto } from './dto/update-school-branding.dto';

@Injectable()
export class SchoolBrandingService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  async assertUserCanManageBranding(
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

    if (!roles.includes('SCHOOL_ADMIN')) {
      throw new ForbiddenException(
        'Only School Admin can update school branding.',
      );
    }
  }

  async getBranding(
    schoolId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanManageBranding(actorUserId, schoolId, platformRole);

    const result = await this.db.query<{
      id: string;
      name: string;
      code: string;
      logo_url: string | null;
      address_line1: string | null;
      address_line2: string | null;
      city: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      director_name: string | null;
      report_card_title_i18n: Record<string, string>;
      report_card_footer_i18n: Record<string, string>;
      branding_updated_at: string | null;
    }>(
      `
      SELECT
        id,
        name,
        code,
        logo_url,
        address_line1,
        address_line2,
        city,
        phone,
        email,
        website,
        director_name,
        report_card_title_i18n,
        report_card_footer_i18n,
        branding_updated_at::text AS branding_updated_at
      FROM schools
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException(`School ${schoolId} not found.`);
    }

    return {
      schoolId: row.id,
      name: row.name,
      code: row.code,
      logoUrl: row.logo_url,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      city: row.city,
      phone: row.phone,
      email: row.email,
      website: row.website,
      directorName: row.director_name,
      reportCardTitleI18n: row.report_card_title_i18n,
      reportCardFooterI18n: row.report_card_footer_i18n,
      brandingUpdatedAt: row.branding_updated_at,
    };
  }

  async updateBranding(
    dto: UpdateSchoolBrandingDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanManageBranding(
      actorUserId,
      dto.schoolId,
      platformRole,
    );

    const result = await this.db.query(
      `
      UPDATE schools
      SET
        logo_url = $2,
        address_line1 = $3,
        address_line2 = $4,
        city = $5,
        phone = $6,
        email = $7,
        website = $8,
        director_name = $9,
        report_card_title_i18n = COALESCE($10::jsonb, report_card_title_i18n),
        report_card_footer_i18n = COALESCE($11::jsonb, report_card_footer_i18n),
        branding_updated_by_user_id = $12,
        branding_updated_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id
      `,
      [
        dto.schoolId,
        dto.logoUrl?.trim() || null,
        dto.addressLine1?.trim() || null,
        dto.addressLine2?.trim() || null,
        dto.city?.trim() || null,
        dto.phone?.trim() || null,
        dto.email?.trim() || null,
        dto.website?.trim() || null,
        dto.directorName?.trim() || null,
        dto.reportCardTitleI18n
          ? JSON.stringify(dto.reportCardTitleI18n)
          : null,
        dto.reportCardFooterI18n
          ? JSON.stringify(dto.reportCardFooterI18n)
          : null,
        actorUserId,
      ],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`School ${dto.schoolId} not found.`);
    }

    await this.platformActivityService.record({
      eventType: 'SCHOOL_BRANDING_UPDATED',
      actorType: platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
      actorUserId,
      schoolId: dto.schoolId,
      summary: 'School branding settings were updated.',
      payload: {
        schoolId: dto.schoolId,
      },
    });

    return this.getBranding(dto.schoolId, actorUserId, platformRole);
  }
}
