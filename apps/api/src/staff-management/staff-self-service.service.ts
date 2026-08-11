import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { CreateStaffLeaveRequestDto } from './dto/create-staff-leave-request.dto';
import { StaffLeaveActionDto } from './dto/staff-leave-action.dto';

type QueryTarget = {
  query<T extends QueryResultRow = any>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

type StaffSelfServiceRow = {
  id: string;
  school_id: string;
  staff_code: string | null;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email_original: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_city: string | null;
  address_region: string | null;
  address_postal_code: string | null;
  address_country_code: string | null;
  staff_category: string;
  employment_type: string;
  employment_status: string;
  hire_date: string | null;
  job_title: string | null;
  department: string | null;
  work_location: string | null;
  supervisor_first_name: string | null;
  supervisor_last_name: string | null;
};

type SelfDocumentRow = {
  id: string;
  document_type: string;
  display_name: string;
  storage_key: string;
  original_file_name: string;
  mime_type: string;
  file_size_bytes: string;
  issued_on: string | null;
  expires_on: string | null;
  created_at: string;
};

type SelfLeaveRow = {
  id: string;
  staff_account_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  requested_days: string;
  request_reason: string;
  request_status: string;
  requested_by_user_id: string;
  reviewed_at: string | null;
  review_note: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class StaffSelfServiceService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  private async requireOwnActiveStaff(
    target: QueryTarget,
    schoolId: string,
    actorUserId: string,
  ) {
    const result = await target.query<StaffSelfServiceRow>(
      `
      SELECT
        staff.id,
        staff.school_id,
        staff.staff_code,
        staff.first_name,
        staff.last_name,
        staff.preferred_name,
        staff.email_original,
        staff.phone,
        staff.address_line_1,
        staff.address_line_2,
        staff.address_city,
        staff.address_region,
        staff.address_postal_code,
        staff.address_country_code,
        staff.staff_category,
        staff.employment_type,
        staff.employment_status,
        staff.hire_date::TEXT,
        staff.job_title,
        staff.department,
        staff.work_location,
        supervisor.first_name AS supervisor_first_name,
        supervisor.last_name AS supervisor_last_name
      FROM school_staff_accounts staff
      JOIN schools school
        ON school.id = staff.school_id
       AND school.deleted_at IS NULL
      JOIN school_memberships membership
        ON membership.school_id = staff.school_id
       AND membership.user_id = staff.user_id
       AND membership.membership_status = 'ACTIVE'
       AND membership.deleted_at IS NULL
      JOIN school_membership_roles membership_role
        ON membership_role.school_membership_id = membership.id
       AND membership_role.role::TEXT IN (
         'SCHOOL_ADMIN',
         'TEACHER',
         'FINANCE_ADMIN'
       )
       AND membership_role.deleted_at IS NULL
      LEFT JOIN school_staff_accounts supervisor
        ON supervisor.id = staff.supervisor_staff_account_id
       AND supervisor.school_id = staff.school_id
       AND supervisor.deleted_at IS NULL
      WHERE staff.school_id = $1
        AND staff.user_id = $2
        AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
        AND staff.deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId, actorUserId],
    );
    const staff = result.rows[0];
    if (!staff) {
      throw new ForbiddenException(
        'Active staff access is required for this school.',
      );
    }
    return staff;
  }

  private mapProfile(row: StaffSelfServiceRow) {
    const supervisorName = [row.supervisor_first_name, row.supervisor_last_name]
      .filter(Boolean)
      .join(' ');
    return {
      id: row.id,
      schoolId: row.school_id,
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
      hireDate: row.hire_date,
      jobTitle: row.job_title,
      department: row.department,
      workLocation: row.work_location,
      supervisorName: supervisorName || null,
    };
  }

  private mapDocument(row: SelfDocumentRow) {
    let expiryStatus:
      | 'NOT_APPLICABLE'
      | 'CURRENT'
      | 'EXPIRING_SOON'
      | 'EXPIRED' = 'NOT_APPLICABLE';
    if (row.expires_on) {
      const expiry = Date.parse(`${row.expires_on}T00:00:00Z`);
      const now = new Date();
      const today = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      );
      const warningBoundary = today + 60 * 86_400_000;
      expiryStatus =
        expiry < today
          ? 'EXPIRED'
          : expiry <= warningBoundary
            ? 'EXPIRING_SOON'
            : 'CURRENT';
    }
    return {
      id: row.id,
      documentType: row.document_type,
      displayName: row.display_name,
      originalFileName: row.original_file_name,
      mimeType: row.mime_type,
      fileSizeBytes: Number(row.file_size_bytes),
      issuedOn: row.issued_on,
      expiresOn: row.expires_on,
      expiryStatus,
      createdAt: row.created_at,
    };
  }

  private mapLeave(row: SelfLeaveRow) {
    return {
      id: row.id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      requestedDays: Number(row.requested_days),
      reason: row.request_reason,
      status: row.request_status,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      rowVersion: row.row_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private validateLeave(dto: CreateStaffLeaveRequestDto) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        'The leave end date cannot precede the start date.',
      );
    }
    const start = Date.parse(`${dto.startDate}T00:00:00Z`);
    const end = Date.parse(`${dto.endDate}T00:00:00Z`);
    const calendarDays = Math.floor((end - start) / 86_400_000) + 1;
    if (dto.requestedDays > calendarDays) {
      throw new BadRequestException(
        'Requested days cannot exceed the selected calendar period.',
      );
    }
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('A leave reason is required.');
    }
    return reason;
  }

  private rethrowDatabaseError(error: unknown): never {
    const rawCode =
      typeof error === 'object' && error && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    const code = typeof rawCode === 'string' ? rawCode : '';
    if (code === 'P0001' || code === '23514') {
      throw new BadRequestException(
        'The leave request violates a workflow rule.',
      );
    }
    if (code === '23505') {
      throw new ConflictException('The record conflicts with existing data.');
    }
    throw error;
  }

  async getProfile(schoolId: string, actorUserId: string) {
    return this.mapProfile(
      await this.requireOwnActiveStaff(this.db, schoolId, actorUserId),
    );
  }

  async listDocuments(schoolId: string, actorUserId: string) {
    const staff = await this.requireOwnActiveStaff(
      this.db,
      schoolId,
      actorUserId,
    );
    const result = await this.db.query<SelfDocumentRow>(
      `
      SELECT
        id,
        document_type,
        display_name,
        storage_key,
        original_file_name,
        mime_type,
        file_size_bytes::TEXT,
        issued_on::TEXT,
        expires_on::TEXT,
        created_at
      FROM staff_documents
      WHERE school_id = $1
        AND staff_account_id = $2
        AND confidentiality = 'STANDARD'
        AND document_status = 'ACTIVE'
        AND deleted_at IS NULL
      ORDER BY expires_on ASC NULLS LAST, created_at DESC
      `,
      [schoolId, staff.id],
    );
    return { items: result.rows.map((row) => this.mapDocument(row)) };
  }

  async getDocumentDownload(
    documentId: string,
    schoolId: string,
    actorUserId: string,
  ) {
    return this.db.withTransaction(async (client) => {
      const staff = await this.requireOwnActiveStaff(
        client,
        schoolId,
        actorUserId,
      );
      const result = await client.query<SelfDocumentRow>(
        `
        SELECT
          id,
          document_type,
          display_name,
          storage_key,
          original_file_name,
          mime_type,
          file_size_bytes::TEXT,
          issued_on::TEXT,
          expires_on::TEXT,
          created_at
        FROM staff_documents
        WHERE id = $1
          AND school_id = $2
          AND staff_account_id = $3
          AND confidentiality = 'STANDARD'
          AND document_status = 'ACTIVE'
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [documentId, schoolId, staff.id],
      );
      const document = result.rows[0];
      if (!document) {
        throw new NotFoundException('Staff document not found.');
      }
      await this.platformActivityService.recordTx(client, {
        eventType: 'STAFF_DOCUMENT_DOWNLOAD_AUTHORIZED',
        actorType: 'SCHOOL_STAFF',
        actorUserId,
        schoolId,
        summary: 'Staff document download authorized.',
        payload: {
          staffId: staff.id,
          documentId,
          documentType: document.document_type,
          confidentiality: 'STANDARD',
          accessChannel: 'SELF_SERVICE',
        },
      });
      return {
        staffAccountId: staff.id,
        storageKey: document.storage_key,
        originalFileName: document.original_file_name,
        mimeType: document.mime_type,
        fileSizeBytes: Number(document.file_size_bytes),
      };
    });
  }

  async listLeaveRequests(schoolId: string, actorUserId: string) {
    const staff = await this.requireOwnActiveStaff(
      this.db,
      schoolId,
      actorUserId,
    );
    const result = await this.db.query<SelfLeaveRow>(
      `
      SELECT
        id,
        staff_account_id,
        leave_type,
        start_date::TEXT,
        end_date::TEXT,
        requested_days::TEXT,
        request_reason,
        request_status,
        reviewed_at,
        review_note,
        row_version,
        created_at,
        updated_at
      FROM staff_leave_requests
      WHERE school_id = $1
        AND staff_account_id = $2
        AND deleted_at IS NULL
      ORDER BY start_date DESC, created_at DESC
      `,
      [schoolId, staff.id],
    );
    return { items: result.rows.map((row) => this.mapLeave(row)) };
  }

  async createLeaveRequest(
    dto: CreateStaffLeaveRequestDto,
    actorUserId: string,
  ) {
    const reason = this.validateLeave(dto);
    try {
      return await this.db.withTransaction(async (client: PoolClient) => {
        const staff = await this.requireOwnActiveStaff(
          client,
          dto.schoolId,
          actorUserId,
        );
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
          [`staff-leave:${dto.schoolId}:${staff.id}`],
        );
        const result = await client.query<SelfLeaveRow>(
          `
          INSERT INTO staff_leave_requests (
            school_id,
            staff_account_id,
            leave_type,
            start_date,
            end_date,
            requested_days,
            request_reason,
            requested_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING
            id,
            staff_account_id,
            leave_type,
            start_date::TEXT,
            end_date::TEXT,
            requested_days::TEXT,
            request_reason,
            request_status,
            reviewed_at,
            review_note,
            row_version,
            created_at,
            updated_at
          `,
          [
            dto.schoolId,
            staff.id,
            dto.leaveType,
            dto.startDate,
            dto.endDate,
            dto.requestedDays,
            reason,
            actorUserId,
          ],
        );
        const leave = result.rows[0];
        await client.query(
          `
          INSERT INTO staff_leave_request_events (
            school_id,
            leave_request_id,
            event_type,
            actor_user_id,
            note
          )
          VALUES ($1, $2, 'SUBMITTED', $3, NULL)
          `,
          [dto.schoolId, leave.id, actorUserId],
        );
        await this.platformActivityService.recordTx(client, {
          eventType: 'STAFF_LEAVE_SUBMITTED',
          actorType: 'SCHOOL_STAFF',
          actorUserId,
          schoolId: dto.schoolId,
          summary: 'Staff leave request submitted through self-service.',
          payload: {
            staffId: staff.id,
            leaveRequestId: leave.id,
            leaveType: leave.leave_type,
            startDate: leave.start_date,
            endDate: leave.end_date,
          },
        });
        return this.mapLeave(leave);
      });
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async cancelLeaveRequest(
    leaveRequestId: string,
    dto: StaffLeaveActionDto,
    actorUserId: string,
  ) {
    try {
      return await this.db.withTransaction(async (client: PoolClient) => {
        const staff = await this.requireOwnActiveStaff(
          client,
          dto.schoolId,
          actorUserId,
        );
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
          [`staff-leave:${dto.schoolId}:${staff.id}`],
        );
        const result = await client.query<SelfLeaveRow>(
          `
          SELECT
            id,
            staff_account_id,
            leave_type,
            start_date::TEXT,
            end_date::TEXT,
            requested_days::TEXT,
            request_reason,
            request_status,
            requested_by_user_id,
            reviewed_at,
            review_note,
            row_version,
            created_at,
            updated_at
          FROM staff_leave_requests
          WHERE id = $1
            AND school_id = $2
            AND staff_account_id = $3
            AND deleted_at IS NULL
          FOR UPDATE
          `,
          [leaveRequestId, dto.schoolId, staff.id],
        );
        const leave = result.rows[0];
        if (!leave) {
          throw new NotFoundException('Staff leave request not found.');
        }
        if (leave.requested_by_user_id !== actorUserId) {
          throw new ForbiddenException(
            'Only a leave request submitted through your account can be withdrawn here.',
          );
        }
        if (leave.row_version !== dto.rowVersion) {
          throw new ConflictException(
            'The leave request changed. Refresh and try again.',
          );
        }
        if (leave.request_status !== 'SUBMITTED') {
          throw new BadRequestException(
            'Only a pending leave request can be withdrawn by the employee.',
          );
        }
        const updatedResult = await client.query<SelfLeaveRow>(
          `
          UPDATE staff_leave_requests
          SET
            request_status = 'CANCELLED',
            reviewed_by_user_id = $4,
            reviewed_at = NOW(),
            review_note = 'Withdrawn by employee.'
          WHERE id = $1
            AND school_id = $2
            AND staff_account_id = $3
          RETURNING
            id,
            staff_account_id,
            leave_type,
            start_date::TEXT,
            end_date::TEXT,
            requested_days::TEXT,
            request_reason,
            request_status,
            requested_by_user_id,
            reviewed_at,
            review_note,
            row_version,
            created_at,
            updated_at
          `,
          [leaveRequestId, dto.schoolId, staff.id, actorUserId],
        );
        await client.query(
          `
          INSERT INTO staff_leave_request_events (
            school_id,
            leave_request_id,
            event_type,
            actor_user_id,
            note
          )
          VALUES ($1, $2, 'CANCELLED', $3, 'Withdrawn by employee.')
          `,
          [dto.schoolId, leaveRequestId, actorUserId],
        );
        await this.platformActivityService.recordTx(client, {
          eventType: 'STAFF_LEAVE_CANCELLED',
          actorType: 'SCHOOL_STAFF',
          actorUserId,
          schoolId: dto.schoolId,
          summary: 'Staff leave request withdrawn through self-service.',
          payload: {
            staffId: staff.id,
            leaveRequestId,
            leaveType: leave.leave_type,
            startDate: leave.start_date,
            endDate: leave.end_date,
          },
        });
        return this.mapLeave(updatedResult.rows[0]);
      });
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }
}
