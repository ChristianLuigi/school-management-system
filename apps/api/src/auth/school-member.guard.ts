import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { DbService } from '../db/db.service';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { RequestWithAuth, extractBearerToken } from './auth-request';
import { ROLES_KEY, SchoolRole } from './roles.decorator';
import { SKIP_SCHOOL_MEMBERSHIP_KEY } from './skip-school-membership.decorator';

@Injectable()
export class SchoolMemberGuard implements CanActivate {
  private internalAuthService: InternalAuthService | null = null;

  constructor(
    private readonly db: DbService,
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const session =
      await this.getInternalAuthService().validateSessionToken(token);
    request.authSession = session;

    const skipGuard =
      this.reflector.getAllAndOverride<boolean>(SKIP_SCHOOL_MEMBERSHIP_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (skipGuard) {
      return true;
    }

    const schoolId = await this.resolveSchoolId(request);

    if (!schoolId) {
      throw new BadRequestException(
        'Unable to resolve schoolId for this request.',
      );
    }

    if (session.platform_role === 'SUPER_ADMIN') {
      const canManage = await this.isSuperAdminManagedSchool(schoolId);

      if (!canManage) {
        throw new ForbiddenException(
          'Super admins can only access schools managed by the platform.',
        );
      }

      request.schoolAccess = {
        schoolId,
        roles: ['SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN'],
      };
      return true;
    }

    const membership = await this.db.query<{
      membership_status: string;
      roles: string[] | null;
    }>(
      `
      SELECT
        sm.membership_status,
        COALESCE(
          ARRAY_AGG(smr.role ORDER BY smr.role) FILTER (WHERE smr.deleted_at IS NULL),
          ARRAY[]::school_staff_role[]
        ) AS roles
      FROM school_memberships sm
      LEFT JOIN school_membership_roles smr ON smr.school_membership_id = sm.id
      WHERE sm.school_id = $1
        AND sm.user_id = $2
        AND sm.deleted_at IS NULL
      GROUP BY sm.membership_status
      LIMIT 1
      `,
      [schoolId, session.user_id],
    );

    const membershipRow = membership.rows[0];

    if (!membershipRow || membershipRow.membership_status !== 'ACTIVE') {
      throw new ForbiddenException(
        'You do not have active access to this school.',
      );
    }

    const grantedRoles = membershipRow.roles ?? [];
    request.schoolAccess = { schoolId, roles: grantedRoles };

    const requiredRoles =
      this.reflector.getAllAndOverride<SchoolRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (
      requiredRoles.length > 0 &&
      !requiredRoles.some((role) => grantedRoles.includes(role))
    ) {
      throw new ForbiddenException(
        'You do not have the required role for this action.',
      );
    }

    return true;
  }

  private getInternalAuthService(): InternalAuthService {
    if (this.internalAuthService) {
      return this.internalAuthService;
    }

    const service = this.moduleRef.get(InternalAuthService, { strict: false });

    if (!service) {
      throw new InternalServerErrorException(
        'Internal auth service is unavailable.',
      );
    }

    this.internalAuthService = service;
    return service;
  }

  private async isSuperAdminManagedSchool(schoolId: string): Promise<boolean> {
    const result = await this.db.query<{ management_mode: string }>(
      `
      SELECT management_mode
      FROM schools
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId],
    );

    const managementMode = result.rows[0]?.management_mode;

    return (
      managementMode === 'SUPERADMIN_MANAGED' ||
      managementMode === 'HYBRID_MANAGED'
    );
  }

  private async resolveSchoolId(request: RequestWithAuth): Promise<string> {
    const direct = this.fromRequest(request, 'schoolId');

    if (direct) {
      return direct;
    }

    const academicYearId = this.fromRequest(request, 'academicYearId');
    if (academicYearId) {
      return this.lookupSchoolId(
        `SELECT school_id FROM academic_years WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        academicYearId,
      );
    }

    const sectionId = this.fromRequest(request, 'sectionId');
    if (sectionId) {
      return this.lookupSchoolId(
        `SELECT school_id FROM sections WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        sectionId,
      );
    }

    const sectionSubjectId = this.fromRequest(request, 'sectionSubjectId');
    if (sectionSubjectId) {
      return this.lookupSchoolId(
        `SELECT school_id FROM section_subjects WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        sectionSubjectId,
      );
    }

    const gradebookId = this.fromRequest(request, 'gradebookId');
    if (gradebookId) {
      return this.lookupSchoolId(
        `
        SELECT ss.school_id
        FROM gradebooks gb
        JOIN section_subjects ss ON ss.id = gb.section_subject_id
        WHERE gb.id = $1
          AND gb.deleted_at IS NULL
          AND ss.deleted_at IS NULL
        LIMIT 1
        `,
        gradebookId,
      );
    }

    const assessmentId = this.fromRequest(request, 'assessmentId');
    if (assessmentId) {
      return this.lookupSchoolId(
        `
        SELECT ss.school_id
        FROM assessments a
        JOIN gradebooks gb ON gb.id = a.gradebook_id
        JOIN section_subjects ss ON ss.id = gb.section_subject_id
        WHERE a.id = $1
          AND a.deleted_at IS NULL
          AND gb.deleted_at IS NULL
          AND ss.deleted_at IS NULL
        LIMIT 1
        `,
        assessmentId,
      );
    }

    const attendanceSessionId = this.fromRequest(
      request,
      'attendanceSessionId',
    );
    if (attendanceSessionId) {
      return this.lookupSchoolId(
        `
        SELECT school_id
        FROM attendance_sessions
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        attendanceSessionId,
      );
    }

    const studentId = this.fromRequest(request, 'studentId');
    if (studentId) {
      return this.lookupSchoolId(
        `SELECT school_id FROM students WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        studentId,
      );
    }

    const invoiceId = this.fromRequest(request, 'invoiceId');
    if (invoiceId) {
      return this.lookupSchoolId(
        `SELECT school_id FROM invoices WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        invoiceId,
      );
    }

    return '';
  }

  private fromRequest(request: RequestWithAuth, key: string): string {
    const fromParams = request.params?.[key];
    if (typeof fromParams === 'string' && fromParams.trim()) {
      return fromParams.trim();
    }

    const fromQuery = request.query?.[key];
    if (typeof fromQuery === 'string' && fromQuery.trim()) {
      return fromQuery.trim();
    }

    const body = request.body as unknown;
    const fromBody =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)[key]
        : undefined;
    if (typeof fromBody === 'string' && fromBody.trim()) {
      return fromBody.trim();
    }

    return '';
  }

  private async lookupSchoolId(query: string, id: string): Promise<string> {
    const result = await this.db.query<{ school_id: string }>(query, [id]);
    return result.rows[0]?.school_id ?? '';
  }
}
