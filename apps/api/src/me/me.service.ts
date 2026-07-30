import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { InternalAuthService } from '../internal-auth/internal-auth.service';

type ManagementMode = 'SELF_MANAGED' | 'SUPERADMIN_MANAGED' | 'HYBRID_MANAGED';

type MembershipSchoolRow = {
  school_id: string;
  school_name: string;
  school_code: string;
  school_status: string;
  management_mode: ManagementMode;
  membership_id: string;
  membership_status: string;
  roles: string[] | null;
};

type SuperAdminSchoolRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  management_mode: ManagementMode;
};

function hasMembershipRoles(
  school: MembershipSchoolRow | SuperAdminSchoolRow | null,
): school is MembershipSchoolRow {
  return Boolean(school && 'roles' in school);
}

@Injectable()
export class MeService {
  constructor(
    private readonly db: DbService,
    private readonly internalAuthService: InternalAuthService,
  ) {}

  async getContext(rawToken: string, schoolId?: string) {
    if (!rawToken) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const session =
      await this.internalAuthService.validateSessionToken(rawToken);

    const memberships = await this.db.query<MembershipSchoolRow>(
      `
      SELECT
        sm.school_id,
        s.name AS school_name,
        s.code AS school_code,
        s.status AS school_status,
        s.management_mode,
        sm.id AS membership_id,
        sm.membership_status,
        COALESCE(
          ARRAY_AGG(smr.role) FILTER (
            WHERE smr.deleted_at IS NULL
              AND (
                smr.role::TEXT NOT IN (
                  'SCHOOL_ADMIN',
                  'TEACHER',
                  'FINANCE_ADMIN'
                )
                OR staff.id IS NOT NULL
              )
          ),
          ARRAY[]::school_staff_role[]
        ) AS roles
      FROM school_memberships sm
      JOIN schools s ON s.id = sm.school_id
      LEFT JOIN school_membership_roles smr
        ON smr.school_membership_id = sm.id
      LEFT JOIN school_staff_accounts staff
        ON staff.school_id = sm.school_id
       AND staff.user_id = sm.user_id
       AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
       AND staff.deleted_at IS NULL
      WHERE sm.user_id = $1
        AND sm.deleted_at IS NULL
        AND s.deleted_at IS NULL
      GROUP BY
        sm.school_id,
        s.name,
        s.code,
        s.status,
        s.management_mode,
        sm.id,
        sm.membership_status
      ORDER BY s.name ASC
      `,
      [session.user_id],
    );

    const isSuperAdmin = session.platform_role === 'SUPER_ADMIN';

    let currentSchool: MembershipSchoolRow | SuperAdminSchoolRow | null = null;

    if (schoolId) {
      if (isSuperAdmin) {
        const schoolResult = await this.db.query<SuperAdminSchoolRow>(
          `
          SELECT id, name, code, status, management_mode
          FROM schools
          WHERE id = $1
            AND deleted_at IS NULL
          LIMIT 1
          `,
          [schoolId],
        );

        currentSchool = schoolResult.rows[0] ?? null;
      } else {
        currentSchool =
          memberships.rows.find((m) => m.school_id === schoolId) ?? null;
      }

      if (!currentSchool) {
        throw new ForbiddenException(
          'You do not have access to the requested school.',
        );
      }
    } else if (!isSuperAdmin && memberships.rows.length === 1) {
      currentSchool = memberships.rows[0];
    }

    return {
      user: {
        id: session.user_id,
        email: session.user_email,
        firstName: session.first_name,
        lastName: session.last_name,
        platformRole: session.platform_role,
      },
      isSuperAdmin,
      availableSchools: memberships.rows,
      currentSchool,
      currentRoles: hasMembershipRoles(currentSchool)
        ? (currentSchool.roles ?? [])
        : [],
    };
  }
}
