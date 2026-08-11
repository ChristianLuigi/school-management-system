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
import { CreateStaffDocumentDto } from './dto/create-staff-document.dto';
import { CreateStaffLeaveRequestDto } from './dto/create-staff-leave-request.dto';
import { RevokeStaffDocumentDto } from './dto/revoke-staff-document.dto';
import { StaffLeaveActionDto } from './dto/staff-leave-action.dto';
import { StaffReportQueryDto } from './dto/staff-report-query.dto';

type QueryTarget = {
  query<T extends QueryResultRow = any>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
    rowCount: number | null;
  }>;
};

type DocumentRow = {
  id: string;
  school_id: string;
  staff_account_id: string;
  document_type: string;
  display_name: string;
  storage_key: string;
  original_file_name: string;
  mime_type: string;
  file_size_bytes: string;
  issued_on: string | null;
  expires_on: string | null;
  confidentiality: string;
  document_status: string;
  row_version: number;
  revoked_at: string | null;
  revocation_reason: string | null;
  created_at: string;
  updated_at: string;
};

type LeaveRow = {
  id: string;
  school_id: string;
  staff_account_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  requested_days: string;
  request_reason: string;
  request_status: string;
  requested_by_user_id: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class StaffComplianceService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  private trim(value: string | undefined | null) {
    return value?.trim() || null;
  }

  private mapDocument(row: DocumentRow, credentialWindowDays = 60) {
    let expiryStatus:
      | 'NOT_APPLICABLE'
      | 'CURRENT'
      | 'EXPIRING_SOON'
      | 'EXPIRED'
      | 'REVOKED' = 'NOT_APPLICABLE';
    if (row.document_status === 'REVOKED') {
      expiryStatus = 'REVOKED';
    } else if (row.expires_on) {
      const expiry = new Date(`${row.expires_on}T00:00:00Z`).getTime();
      const today = new Date();
      const startOfToday = Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
      );
      const warningBoundary =
        startOfToday + credentialWindowDays * 24 * 60 * 60 * 1000;
      expiryStatus =
        expiry < startOfToday
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
      confidentiality: row.confidentiality,
      status: row.document_status,
      expiryStatus,
      rowVersion: row.row_version,
      revokedAt: row.revoked_at,
      revocationReason: row.revocation_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapLeave(row: LeaveRow) {
    return {
      id: row.id,
      staffAccountId: row.staff_account_id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      requestedDays: Number(row.requested_days),
      reason: row.request_reason,
      status: row.request_status,
      requestedByUserId: row.requested_by_user_id,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      rowVersion: row.row_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
      JOIN schools school
        ON school.id = membership.school_id
       AND school.deleted_at IS NULL
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

  private async assertStaff(
    target: QueryTarget,
    staffId: string,
    schoolId: string,
    allowArchived = true,
  ) {
    const result = await target.query<{
      id: string;
      employment_status: string;
      first_name: string | null;
      last_name: string | null;
      staff_code: string | null;
    }>(
      `
      SELECT
        id,
        employment_status,
        first_name,
        last_name,
        staff_code
      FROM school_staff_accounts
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [staffId, schoolId],
    );
    const staff = result.rows[0];
    if (!staff) {
      throw new NotFoundException('Staff record not found.');
    }
    if (
      !allowArchived &&
      ['TERMINATED', 'ARCHIVED'].includes(staff.employment_status)
    ) {
      throw new BadRequestException(
        'This operation is unavailable for terminated or archived staff.',
      );
    }
    return staff;
  }

  private rethrowDatabaseError(error: unknown): never {
    const rawCode =
      typeof error === 'object' && error
        ? (error as { code?: unknown }).code
        : undefined;
    const code = typeof rawCode === 'string' ? rawCode : '';
    const message =
      error instanceof Error ? error.message : 'Database operation failed.';
    if (code === 'P0001' || code === '23514') {
      throw new BadRequestException(message);
    }
    if (code === '23505') {
      throw new ConflictException('The record conflicts with existing data.');
    }
    throw error;
  }

  async listDocuments(staffId: string, schoolId: string, actorUserId: string) {
    await this.assertSchoolAdministrator(this.db, schoolId, actorUserId);
    await this.assertStaff(this.db, staffId, schoolId);
    const result = await this.db.query<DocumentRow>(
      `
      SELECT
        id,
        school_id,
        staff_account_id,
        document_type,
        display_name,
        storage_key,
        original_file_name,
        mime_type,
        file_size_bytes::TEXT,
        issued_on::TEXT,
        expires_on::TEXT,
        confidentiality,
        document_status,
        row_version,
        revoked_at,
        revocation_reason,
        created_at,
        updated_at
      FROM staff_documents
      WHERE school_id = $1
        AND staff_account_id = $2
        AND deleted_at IS NULL
      ORDER BY
        document_status ASC,
        expires_on ASC NULLS LAST,
        created_at DESC
      `,
      [schoolId, staffId],
    );
    return {
      items: result.rows.map((row) => this.mapDocument(row)),
    };
  }

  async createDocument(
    staffId: string,
    dto: CreateStaffDocumentDto,
    actorUserId: string,
  ) {
    const storageKey = dto.storageKey.replaceAll('\\', '/').trim();
    const expectedPrefix = `${dto.schoolId}/${staffId}/`;
    if (
      storageKey !== dto.storageKey ||
      storageKey.includes('..') ||
      !storageKey.startsWith(expectedPrefix)
    ) {
      throw new BadRequestException('Invalid staff document storage key.');
    }
    if (dto.issuedOn && dto.expiresOn && dto.expiresOn < dto.issuedOn) {
      throw new BadRequestException(
        'The document expiry date cannot precede its issue date.',
      );
    }
    try {
      return await this.db.withTransaction(async (client) => {
        await this.assertSchoolAdministrator(client, dto.schoolId, actorUserId);
        await this.assertStaff(client, staffId, dto.schoolId, false);
        const result = await client.query<DocumentRow>(
          `
          INSERT INTO staff_documents (
            school_id,
            staff_account_id,
            document_type,
            display_name,
            storage_key,
            original_file_name,
            mime_type,
            file_size_bytes,
            issued_on,
            expires_on,
            confidentiality,
            uploaded_by_user_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12
          )
          RETURNING
            id,
            school_id,
            staff_account_id,
            document_type,
            display_name,
            storage_key,
            original_file_name,
            mime_type,
            file_size_bytes::TEXT,
            issued_on::TEXT,
            expires_on::TEXT,
            confidentiality,
            document_status,
            row_version,
            revoked_at,
            revocation_reason,
            created_at,
            updated_at
          `,
          [
            dto.schoolId,
            staffId,
            dto.documentType,
            dto.displayName.trim(),
            storageKey,
            dto.originalFileName.trim(),
            dto.mimeType,
            dto.fileSizeBytes,
            dto.issuedOn ?? null,
            dto.expiresOn ?? null,
            dto.confidentiality ?? 'STANDARD',
            actorUserId,
          ],
        );
        const document = result.rows[0];
        await this.platformActivityService.recordTx(client, {
          eventType: 'STAFF_DOCUMENT_ADDED',
          actorType: 'SCHOOL_STAFF',
          actorUserId,
          schoolId: dto.schoolId,
          summary: 'Staff document added.',
          payload: {
            staffId,
            documentId: document.id,
            documentType: document.document_type,
            confidentiality: document.confidentiality,
            expiresOn: document.expires_on,
          },
        });
        return this.mapDocument(document);
      });
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async getDocumentDownload(
    staffId: string,
    documentId: string,
    schoolId: string,
    actorUserId: string,
  ) {
    return this.db.withTransaction(async (client) => {
      await this.assertSchoolAdministrator(client, schoolId, actorUserId);
      const result = await client.query<DocumentRow>(
        `
        SELECT
          id,
          school_id,
          staff_account_id,
          document_type,
          display_name,
          storage_key,
          original_file_name,
          mime_type,
          file_size_bytes::TEXT,
          issued_on::TEXT,
          expires_on::TEXT,
          confidentiality,
          document_status,
          row_version,
          revoked_at,
          revocation_reason,
          created_at,
          updated_at
        FROM staff_documents
        WHERE id = $1
          AND staff_account_id = $2
          AND school_id = $3
          AND document_status = 'ACTIVE'
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [documentId, staffId, schoolId],
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
          staffId,
          documentId,
          documentType: document.document_type,
          confidentiality: document.confidentiality,
          accessChannel: 'ADMINISTRATION',
        },
      });
      return {
        storageKey: document.storage_key,
        originalFileName: document.original_file_name,
        mimeType: document.mime_type,
        fileSizeBytes: Number(document.file_size_bytes),
      };
    });
  }

  async revokeDocument(
    staffId: string,
    documentId: string,
    dto: RevokeStaffDocumentDto,
    actorUserId: string,
  ) {
    const reason = this.trim(dto.reason);
    if (!reason) {
      throw new BadRequestException('A revocation reason is required.');
    }
    try {
      return await this.db.withTransaction(async (client) => {
        await this.assertSchoolAdministrator(client, dto.schoolId, actorUserId);
        const result = await client.query<DocumentRow>(
          `
          SELECT
            id,
            school_id,
            staff_account_id,
            document_type,
            display_name,
            storage_key,
            original_file_name,
            mime_type,
            file_size_bytes::TEXT,
            issued_on::TEXT,
            expires_on::TEXT,
            confidentiality,
            document_status,
            row_version,
            revoked_at,
            revocation_reason,
            created_at,
            updated_at
          FROM staff_documents
          WHERE id = $1
            AND staff_account_id = $2
            AND school_id = $3
            AND deleted_at IS NULL
          FOR UPDATE
          `,
          [documentId, staffId, dto.schoolId],
        );
        const document = result.rows[0];
        if (!document) {
          throw new NotFoundException('Staff document not found.');
        }
        if (document.row_version !== dto.rowVersion) {
          throw new ConflictException(
            'The staff document changed. Refresh and try again.',
          );
        }
        if (document.document_status !== 'ACTIVE') {
          throw new BadRequestException('The staff document is not active.');
        }
        const updatedResult = await client.query<DocumentRow>(
          `
          UPDATE staff_documents
          SET
            document_status = 'REVOKED',
            revoked_by_user_id = $4,
            revoked_at = NOW(),
            revocation_reason = $5
          WHERE id = $1
            AND staff_account_id = $2
            AND school_id = $3
          RETURNING
            id,
            school_id,
            staff_account_id,
            document_type,
            display_name,
            storage_key,
            original_file_name,
            mime_type,
            file_size_bytes::TEXT,
            issued_on::TEXT,
            expires_on::TEXT,
            confidentiality,
            document_status,
            row_version,
            revoked_at,
            revocation_reason,
            created_at,
            updated_at
          `,
          [documentId, staffId, dto.schoolId, actorUserId, reason],
        );
        await this.platformActivityService.recordTx(client, {
          eventType: 'STAFF_DOCUMENT_REVOKED',
          actorType: 'SCHOOL_STAFF',
          actorUserId,
          schoolId: dto.schoolId,
          summary: 'Staff document revoked.',
          payload: {
            staffId,
            documentId,
            documentType: document.document_type,
          },
        });
        return this.mapDocument(updatedResult.rows[0]);
      });
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async listLeaveRequests(
    staffId: string,
    schoolId: string,
    actorUserId: string,
  ) {
    await this.assertSchoolAdministrator(this.db, schoolId, actorUserId);
    await this.assertStaff(this.db, staffId, schoolId);
    const [requestsResult, eventsResult] = await Promise.all([
      this.db.query<LeaveRow>(
        `
        SELECT
          id,
          school_id,
          staff_account_id,
          leave_type,
          start_date::TEXT,
          end_date::TEXT,
          requested_days::TEXT,
          request_reason,
          request_status,
          requested_by_user_id,
          reviewed_by_user_id,
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
        [schoolId, staffId],
      ),
      this.db.query<{
        id: string;
        leave_request_id: string;
        event_type: string;
        actor_user_id: string;
        note: string | null;
        created_at: string;
      }>(
        `
        SELECT
          event.id,
          event.leave_request_id,
          event.event_type,
          event.actor_user_id,
          event.note,
          event.created_at
        FROM staff_leave_request_events event
        JOIN staff_leave_requests request
          ON request.id = event.leave_request_id
         AND request.school_id = event.school_id
        WHERE event.school_id = $1
          AND request.staff_account_id = $2
        ORDER BY event.created_at
        `,
        [schoolId, staffId],
      ),
    ]);
    const eventsByRequest = new Map<string, typeof eventsResult.rows>();
    for (const event of eventsResult.rows) {
      const events = eventsByRequest.get(event.leave_request_id) ?? [];
      events.push(event);
      eventsByRequest.set(event.leave_request_id, events);
    }
    return {
      items: requestsResult.rows.map((row) => ({
        ...this.mapLeave(row),
        events: (eventsByRequest.get(row.id) ?? []).map((event) => ({
          id: event.id,
          type: event.event_type,
          actorUserId: event.actor_user_id,
          note: event.note,
          createdAt: event.created_at,
        })),
      })),
    };
  }

  async createLeaveRequest(
    staffId: string,
    dto: CreateStaffLeaveRequestDto,
    actorUserId: string,
  ) {
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
    const reason = this.trim(dto.reason);
    if (!reason) {
      throw new BadRequestException('A leave reason is required.');
    }
    try {
      return await this.db.withTransaction(async (client) => {
        await this.assertSchoolAdministrator(client, dto.schoolId, actorUserId);
        const staff = await this.assertStaff(
          client,
          staffId,
          dto.schoolId,
          false,
        );
        if (!['ACTIVE', 'ON_LEAVE'].includes(staff.employment_status)) {
          throw new BadRequestException(
            'Leave can only be recorded for active staff.',
          );
        }
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
          [`staff-leave:${dto.schoolId}:${staffId}`],
        );
        const result = await client.query<LeaveRow>(
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
            school_id,
            staff_account_id,
            leave_type,
            start_date::TEXT,
            end_date::TEXT,
            requested_days::TEXT,
            request_reason,
            request_status,
            requested_by_user_id,
            reviewed_by_user_id,
            reviewed_at,
            review_note,
            row_version,
            created_at,
            updated_at
          `,
          [
            dto.schoolId,
            staffId,
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
          summary: 'Staff leave request submitted.',
          payload: {
            staffId,
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

  private async activeAdministratorCount(client: PoolClient, schoolId: string) {
    const result = await client.query<{ count: string }>(
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
      [schoolId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async transitionLeaveRequest(
    leaveRequestId: string,
    nextStatus: 'APPROVED' | 'REJECTED' | 'CANCELLED',
    dto: StaffLeaveActionDto,
    actorUserId: string,
  ) {
    const note = this.trim(dto.note);
    if (nextStatus === 'REJECTED' && !note) {
      throw new BadRequestException('A rejection note is required.');
    }
    try {
      return await this.db.withTransaction(async (client) => {
        await this.assertSchoolAdministrator(client, dto.schoolId, actorUserId);
        const result = await client.query<LeaveRow>(
          `
          SELECT
            id,
            school_id,
            staff_account_id,
            leave_type,
            start_date::TEXT,
            end_date::TEXT,
            requested_days::TEXT,
            request_reason,
            request_status,
            requested_by_user_id,
            reviewed_by_user_id,
            reviewed_at,
            review_note,
            row_version,
            created_at,
            updated_at
          FROM staff_leave_requests
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          FOR UPDATE
          `,
          [leaveRequestId, dto.schoolId],
        );
        const leave = result.rows[0];
        if (!leave) {
          throw new NotFoundException('Staff leave request not found.');
        }
        if (leave.row_version !== dto.rowVersion) {
          throw new ConflictException(
            'The leave request changed. Refresh and try again.',
          );
        }
        const allowed =
          leave.request_status === 'SUBMITTED' ||
          (leave.request_status === 'APPROVED' && nextStatus === 'CANCELLED');
        if (!allowed) {
          throw new BadRequestException(
            `The leave request cannot move from ${leave.request_status} to ${nextStatus}.`,
          );
        }
        if (
          nextStatus === 'APPROVED' &&
          leave.requested_by_user_id === actorUserId &&
          (await this.activeAdministratorCount(client, dto.schoolId)) > 1
        ) {
          throw new ForbiddenException(
            'Another School Administrator must approve this leave request.',
          );
        }
        const updatedResult = await client.query<LeaveRow>(
          `
          UPDATE staff_leave_requests
          SET
            request_status = $3,
            reviewed_by_user_id = $4,
            reviewed_at = NOW(),
            review_note = $5
          WHERE id = $1
            AND school_id = $2
          RETURNING
            id,
            school_id,
            staff_account_id,
            leave_type,
            start_date::TEXT,
            end_date::TEXT,
            requested_days::TEXT,
            request_reason,
            request_status,
            requested_by_user_id,
            reviewed_by_user_id,
            reviewed_at,
            review_note,
            row_version,
            created_at,
            updated_at
          `,
          [leaveRequestId, dto.schoolId, nextStatus, actorUserId, note],
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
          VALUES ($1, $2, $3, $4, $5)
          `,
          [dto.schoolId, leaveRequestId, nextStatus, actorUserId, note],
        );
        await this.platformActivityService.recordTx(client, {
          eventType: `STAFF_LEAVE_${nextStatus}`,
          actorType: 'SCHOOL_STAFF',
          actorUserId,
          schoolId: dto.schoolId,
          summary: `Staff leave request ${nextStatus.toLowerCase()}.`,
          payload: {
            staffId: leave.staff_account_id,
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

  approveLeaveRequest(
    leaveRequestId: string,
    dto: StaffLeaveActionDto,
    actorUserId: string,
  ) {
    return this.transitionLeaveRequest(
      leaveRequestId,
      'APPROVED',
      dto,
      actorUserId,
    );
  }

  rejectLeaveRequest(
    leaveRequestId: string,
    dto: StaffLeaveActionDto,
    actorUserId: string,
  ) {
    return this.transitionLeaveRequest(
      leaveRequestId,
      'REJECTED',
      dto,
      actorUserId,
    );
  }

  cancelLeaveRequest(
    leaveRequestId: string,
    dto: StaffLeaveActionDto,
    actorUserId: string,
  ) {
    return this.transitionLeaveRequest(
      leaveRequestId,
      'CANCELLED',
      dto,
      actorUserId,
    );
  }

  async getOperationalReport(query: StaffReportQueryDto, actorUserId: string) {
    await this.assertSchoolAdministrator(this.db, query.schoolId, actorUserId);
    const credentialWindowDays = query.credentialWindowDays ?? 60;
    const [
      statusResult,
      categoryResult,
      gapResult,
      credentialResult,
      leaveResult,
    ] = await Promise.all([
      this.db.query<{ label: string; count: string }>(
        `
        SELECT employment_status AS label, COUNT(*)::TEXT AS count
        FROM school_staff_accounts
        WHERE school_id = $1
          AND deleted_at IS NULL
        GROUP BY employment_status
        ORDER BY employment_status
        `,
        [query.schoolId],
      ),
      this.db.query<{ label: string; count: string }>(
        `
        SELECT staff_category AS label, COUNT(*)::TEXT AS count
        FROM school_staff_accounts
        WHERE school_id = $1
          AND deleted_at IS NULL
        GROUP BY staff_category
        ORDER BY staff_category
        `,
        [query.schoolId],
      ),
      this.db.query<{
        total_staff: string;
        unlinked_accounts: string;
        missing_payroll_profiles: string;
        teachers_without_assignments: string;
      }>(
        `
        SELECT
          COUNT(*)::TEXT AS total_staff,
          COUNT(*) FILTER (
            WHERE staff.user_id IS NULL
              AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
          )::TEXT AS unlinked_accounts,
          COUNT(*) FILTER (
            WHERE staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
              AND payroll.id IS NULL
          )::TEXT AS missing_payroll_profiles,
          COUNT(*) FILTER (
            WHERE staff.staff_category = 'TEACHING'
              AND staff.employment_status = 'ACTIVE'
              AND assignment.id IS NULL
          )::TEXT AS teachers_without_assignments
        FROM school_staff_accounts staff
        LEFT JOIN payroll_staff_profiles payroll
          ON payroll.school_staff_account_id = staff.id
         AND payroll.school_id = staff.school_id
         AND payroll.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT assignment.id
          FROM teacher_academic_assignments assignment
          WHERE assignment.school_id = staff.school_id
            AND assignment.teacher_staff_account_id = staff.id
            AND assignment.assignment_status = 'ACTIVE'
            AND assignment.deleted_at IS NULL
          LIMIT 1
        ) assignment ON TRUE
        WHERE staff.school_id = $1
          AND staff.deleted_at IS NULL
        `,
        [query.schoolId],
      ),
      this.db.query<{
        document_id: string;
        staff_id: string;
        staff_code: string | null;
        first_name: string | null;
        last_name: string | null;
        document_type: string;
        display_name: string;
        expires_on: string;
      }>(
        `
        SELECT
          document.id AS document_id,
          staff.id AS staff_id,
          staff.staff_code,
          staff.first_name,
          staff.last_name,
          document.document_type,
          document.display_name,
          document.expires_on::TEXT
        FROM staff_documents document
        JOIN school_staff_accounts staff
          ON staff.id = document.staff_account_id
         AND staff.school_id = document.school_id
         AND staff.deleted_at IS NULL
        WHERE document.school_id = $1
          AND document.document_status = 'ACTIVE'
          AND document.deleted_at IS NULL
          AND document.expires_on IS NOT NULL
          AND document.expires_on <=
            CURRENT_DATE + make_interval(days => $2)
        ORDER BY document.expires_on, staff.last_name, staff.first_name
        LIMIT 100
        `,
        [query.schoolId, credentialWindowDays],
      ),
      this.db.query<{
        leave_request_id: string;
        staff_id: string;
        staff_code: string | null;
        first_name: string | null;
        last_name: string | null;
        leave_type: string;
        request_status: string;
        start_date: string;
        end_date: string;
      }>(
        `
        SELECT
          request.id AS leave_request_id,
          staff.id AS staff_id,
          staff.staff_code,
          staff.first_name,
          staff.last_name,
          request.leave_type,
          request.request_status,
          request.start_date::TEXT,
          request.end_date::TEXT
        FROM staff_leave_requests request
        JOIN school_staff_accounts staff
          ON staff.id = request.staff_account_id
         AND staff.school_id = request.school_id
         AND staff.deleted_at IS NULL
        WHERE request.school_id = $1
          AND request.deleted_at IS NULL
          AND (
            request.request_status = 'SUBMITTED'
            OR (
              request.request_status = 'APPROVED'
              AND request.end_date >= CURRENT_DATE
            )
          )
        ORDER BY
          CASE WHEN request.request_status = 'SUBMITTED' THEN 0 ELSE 1 END,
          request.start_date
        LIMIT 100
        `,
        [query.schoolId],
      ),
    ]);
    const [payrollEligibilityResult, accessReconciliationResult] =
      await Promise.all([
        this.db.query<{
          staff_id: string;
          staff_code: string | null;
          first_name: string | null;
          last_name: string | null;
          employment_status: string;
          payroll_profile_id: string | null;
          payroll_active: boolean | null;
          currency_code: string | null;
          pay_frequency: string | null;
          compensation_effective_from: string | null;
        }>(
          `
          SELECT
            staff.id AS staff_id,
            staff.staff_code,
            staff.first_name,
            staff.last_name,
            staff.employment_status,
            profile.id AS payroll_profile_id,
            profile.payroll_active,
            compensation.currency_code,
            compensation.pay_frequency,
            compensation.effective_from::TEXT AS compensation_effective_from
          FROM school_staff_accounts staff
          LEFT JOIN payroll_staff_profiles profile
            ON profile.school_id = staff.school_id
           AND profile.school_staff_account_id = staff.id
           AND profile.deleted_at IS NULL
          LEFT JOIN LATERAL (
            SELECT
              version.currency_code,
              version.pay_frequency,
              version.effective_from
            FROM payroll_compensation_versions version
            WHERE version.school_id = staff.school_id
              AND version.staff_account_id = staff.id
              AND version.effective_from <= CURRENT_DATE
            ORDER BY version.effective_from DESC, version.created_at DESC
            LIMIT 1
          ) compensation ON TRUE
          WHERE staff.school_id = $1
            AND staff.deleted_at IS NULL
          ORDER BY staff.last_name NULLS LAST, staff.first_name NULLS LAST,
            staff.staff_code
          `,
          [query.schoolId],
        ),
        this.db.query<{
          staff_id: string;
          staff_code: string | null;
          first_name: string | null;
          last_name: string | null;
          staff_type: string | null;
          employment_status: string;
          user_id: string | null;
          account_user_id: string | null;
          account_status: string | null;
          email_verified_at: string | null;
          membership_status: string | null;
          active_roles: string[] | null;
          active_session_count: string;
        }>(
          `
          SELECT
            staff.id AS staff_id,
            staff.staff_code,
            staff.first_name,
            staff.last_name,
            staff.staff_type,
            staff.employment_status,
            staff.user_id,
            usr.id AS account_user_id,
            usr.account_status,
            usr.email_verified_at,
            membership_access.membership_status,
            membership_access.active_roles,
            COALESCE(session_count.active_session_count, 0)::TEXT
              AS active_session_count
          FROM school_staff_accounts staff
          LEFT JOIN users usr
            ON usr.id = staff.user_id
           AND usr.deleted_at IS NULL
          LEFT JOIN LATERAL (
            SELECT
              membership.membership_status::TEXT AS membership_status,
              COALESCE(
                ARRAY_AGG(
                  membership_role.role::TEXT
                  ORDER BY membership_role.role::TEXT
                ) FILTER (WHERE membership_role.deleted_at IS NULL),
                ARRAY[]::TEXT[]
              ) AS active_roles
            FROM school_memberships membership
            LEFT JOIN school_membership_roles membership_role
              ON membership_role.school_membership_id = membership.id
             AND membership_role.deleted_at IS NULL
            WHERE membership.school_id = staff.school_id
              AND membership.user_id = staff.user_id
              AND membership.deleted_at IS NULL
            GROUP BY membership.id
            ORDER BY membership.created_at DESC, membership.id DESC
            LIMIT 1
          ) membership_access ON TRUE
          LEFT JOIN LATERAL (
            SELECT COUNT(*) AS active_session_count
            FROM auth_sessions session
            WHERE session.user_id = staff.user_id
              AND session.revoked_at IS NULL
              AND session.expires_at > NOW()
          ) session_count ON TRUE
          WHERE staff.school_id = $1
            AND staff.deleted_at IS NULL
          ORDER BY staff.last_name NULLS LAST, staff.first_name NULLS LAST,
            staff.staff_code
          `,
          [query.schoolId],
        ),
      ]);
    const [departmentHeadcountResult, teacherCoverageResult] =
      await Promise.all([
        this.db.query<{
          department: string | null;
          active_count: string;
          total_count: string;
        }>(
          `
          SELECT
            NULLIF(BTRIM(department), '') AS department,
            COUNT(*) FILTER (
              WHERE employment_status IN ('ACTIVE', 'ON_LEAVE')
            )::TEXT AS active_count,
            COUNT(*)::TEXT AS total_count
          FROM school_staff_accounts
          WHERE school_id = $1
            AND deleted_at IS NULL
          GROUP BY NULLIF(BTRIM(department), '')
          ORDER BY COUNT(*) FILTER (
            WHERE employment_status IN ('ACTIVE', 'ON_LEAVE')
          ) DESC, department NULLS LAST
          `,
          [query.schoolId],
        ),
        this.db.query<{
          staff_id: string;
          staff_code: string | null;
          first_name: string | null;
          last_name: string | null;
          employment_status: string;
          user_id: string | null;
          assignment_id: string | null;
          academic_year_id: string | null;
          academic_year_name_i18n: Record<string, string> | null;
          section_id: string | null;
          section_code: string | null;
          section_name_i18n: Record<string, string> | null;
          subject_id: string | null;
          subject_code: string | null;
          subject_name_i18n: Record<string, string> | null;
        }>(
          `
          SELECT
            staff.id AS staff_id,
            staff.staff_code,
            staff.first_name,
            staff.last_name,
            staff.employment_status,
            staff.user_id,
            assignment.id AS assignment_id,
            academic_year.id AS academic_year_id,
            academic_year.name_i18n AS academic_year_name_i18n,
            section.id AS section_id,
            section.code AS section_code,
            section.name_i18n AS section_name_i18n,
            subject.id AS subject_id,
            subject.code AS subject_code,
            subject.name_i18n AS subject_name_i18n
          FROM school_staff_accounts staff
          LEFT JOIN teacher_academic_assignments assignment
            ON assignment.school_id = staff.school_id
           AND assignment.teacher_staff_account_id = staff.id
           AND assignment.assignment_status = 'ACTIVE'
           AND assignment.deleted_at IS NULL
          LEFT JOIN academic_years academic_year
            ON academic_year.id = assignment.academic_year_id
           AND academic_year.school_id = assignment.school_id
           AND academic_year.deleted_at IS NULL
          LEFT JOIN sections section
            ON section.id = assignment.section_id
           AND section.school_id = assignment.school_id
           AND section.deleted_at IS NULL
          LEFT JOIN school_subjects subject
            ON subject.id = assignment.subject_id
           AND subject.school_id = assignment.school_id
           AND subject.deleted_at IS NULL
          WHERE staff.school_id = $1
            AND staff.deleted_at IS NULL
            AND (
              staff.staff_category = 'TEACHING'
              OR staff.staff_type = 'TEACHER'
            )
          ORDER BY
            staff.last_name NULLS LAST,
            staff.first_name NULLS LAST,
            academic_year.start_date DESC NULLS LAST,
            section.code NULLS LAST,
            subject.code NULLS LAST
          `,
          [query.schoolId],
        ),
      ]);
    const gaps = gapResult.rows[0];
    const statusCounts = Object.fromEntries(
      statusResult.rows.map((row) => [row.label, Number(row.count)]),
    );
    const categoryCounts = Object.fromEntries(
      categoryResult.rows.map((row) => [row.label, Number(row.count)]),
    );
    const today = new Date().toISOString().slice(0, 10);
    const payrollEligibility = payrollEligibilityResult.rows.map((row) => {
      let eligibilityStatus = 'READY';
      if (!['ACTIVE', 'ON_LEAVE'].includes(row.employment_status)) {
        eligibilityStatus = 'NOT_CURRENTLY_EMPLOYED';
      } else if (!row.payroll_profile_id) {
        eligibilityStatus = 'MISSING_PROFILE';
      } else if (!row.payroll_active) {
        eligibilityStatus = 'PROFILE_INACTIVE';
      } else if (!row.compensation_effective_from) {
        eligibilityStatus = 'MISSING_COMPENSATION';
      }
      return {
        staffId: row.staff_id,
        staffCode: row.staff_code,
        firstName: row.first_name,
        lastName: row.last_name,
        employmentStatus: row.employment_status,
        eligibilityStatus,
        currencyCode: row.currency_code,
        payFrequency: row.pay_frequency,
        compensationEffectiveFrom: row.compensation_effective_from,
      };
    });
    const accessReconciliation = accessReconciliationResult.rows.map((row) => {
      const activeRoles = row.active_roles ?? [];
      const activeSessionCount = Number(row.active_session_count);
      const employmentAllowsAccess = ['ACTIVE', 'ON_LEAVE'].includes(
        row.employment_status,
      );
      let accessStatus = 'ALIGNED';
      if (!row.user_id) {
        accessStatus = 'NO_LOGIN';
      } else if (!row.account_user_id || row.account_status !== 'ACTIVE') {
        accessStatus = 'ACCOUNT_INACTIVE';
      } else if (!employmentAllowsAccess) {
        accessStatus =
          row.membership_status === 'ACTIVE'
            ? 'ACCESS_SHOULD_BE_DISABLED'
            : 'ACCESS_DISABLED';
      } else if (row.membership_status !== 'ACTIVE') {
        accessStatus = 'MISSING_ACTIVE_MEMBERSHIP';
      } else if (row.staff_type && !activeRoles.includes(row.staff_type)) {
        accessStatus = 'ROLE_MISMATCH';
      }
      return {
        staffId: row.staff_id,
        staffCode: row.staff_code,
        firstName: row.first_name,
        lastName: row.last_name,
        staffType: row.staff_type,
        employmentStatus: row.employment_status,
        linked: Boolean(row.user_id),
        accountStatus: row.account_status,
        emailVerified: Boolean(row.email_verified_at),
        membershipStatus: row.membership_status,
        activeRoles,
        activeSessionCount,
        accessStatus,
        requiresAttention: [
          'ACCOUNT_INACTIVE',
          'ACCESS_SHOULD_BE_DISABLED',
          'MISSING_ACTIVE_MEMBERSHIP',
          'ROLE_MISMATCH',
        ].includes(accessStatus),
      };
    });
    const departmentHeadcount = departmentHeadcountResult.rows.map((row) => ({
      department: row.department,
      currentHeadcount: Number(row.active_count),
      staffRecordCount: Number(row.total_count),
    }));
    const teacherCoverageByStaff = new Map<
      string,
      {
        staffId: string;
        staffCode: string | null;
        firstName: string | null;
        lastName: string | null;
        employmentStatus: string;
        linked: boolean;
        assignments: Array<{
          assignmentId: string;
          academicYearId: string;
          academicYearNameI18n: Record<string, string> | null;
          sectionId: string;
          sectionCode: string | null;
          sectionNameI18n: Record<string, string> | null;
          subjectId: string;
          subjectCode: string | null;
          subjectNameI18n: Record<string, string> | null;
        }>;
      }
    >();
    for (const row of teacherCoverageResult.rows) {
      if (!teacherCoverageByStaff.has(row.staff_id)) {
        teacherCoverageByStaff.set(row.staff_id, {
          staffId: row.staff_id,
          staffCode: row.staff_code,
          firstName: row.first_name,
          lastName: row.last_name,
          employmentStatus: row.employment_status,
          linked: Boolean(row.user_id),
          assignments: [],
        });
      }
      if (
        row.assignment_id &&
        row.academic_year_id &&
        row.section_id &&
        row.subject_id
      ) {
        teacherCoverageByStaff.get(row.staff_id)!.assignments.push({
          assignmentId: row.assignment_id,
          academicYearId: row.academic_year_id,
          academicYearNameI18n: row.academic_year_name_i18n,
          sectionId: row.section_id,
          sectionCode: row.section_code,
          sectionNameI18n: row.section_name_i18n,
          subjectId: row.subject_id,
          subjectCode: row.subject_code,
          subjectNameI18n: row.subject_name_i18n,
        });
      }
    }
    const teacherAssignmentCoverage = Array.from(
      teacherCoverageByStaff.values(),
    ).map((teacher) => {
      let coverageStatus = 'ASSIGNED';
      if (teacher.employmentStatus !== 'ACTIVE') {
        coverageStatus = 'NOT_ACTIVE';
      } else if (!teacher.assignments.length) {
        coverageStatus = 'NO_ASSIGNMENTS';
      } else if (!teacher.linked) {
        coverageStatus = 'ASSIGNED_NO_LOGIN';
      }
      return {
        ...teacher,
        assignmentCount: teacher.assignments.length,
        sectionCount: new Set(
          teacher.assignments.map((assignment) => assignment.sectionId),
        ).size,
        subjectCount: new Set(
          teacher.assignments.map((assignment) => assignment.subjectId),
        ).size,
        coverageStatus,
        requiresAttention: [
          'NO_ASSIGNMENTS',
          'ASSIGNED_NO_LOGIN',
        ].includes(coverageStatus),
      };
    });    return {
      generatedAt: new Date().toISOString(),
      credentialWindowDays,
      totals: {
        staff: Number(gaps?.total_staff ?? 0),
        unlinkedAccounts: Number(gaps?.unlinked_accounts ?? 0),
        missingPayrollProfiles: Number(gaps?.missing_payroll_profiles ?? 0),
        teachersWithoutAssignments: Number(
          gaps?.teachers_without_assignments ?? 0,
        ),
        expiredCredentials: credentialResult.rows.filter(
          (row) => row.expires_on < today,
        ).length,
        expiringCredentials: credentialResult.rows.filter(
          (row) => row.expires_on >= today,
        ).length,
        pendingLeaveRequests: leaveResult.rows.filter(
          (row) => row.request_status === 'SUBMITTED',
        ).length,
        payrollReady: payrollEligibility.filter(
          (item) => item.eligibilityStatus === 'READY',
        ).length,
        payrollBlocked: payrollEligibility.filter(
          (item) =>
            !['READY', 'NOT_CURRENTLY_EMPLOYED'].includes(
              item.eligibilityStatus,
            ),
        ).length,
        accessIssues: accessReconciliation.filter(
          (item) => item.requiresAttention,
        ).length,
        currentHeadcount: departmentHeadcount.reduce(
          (total, department) => total + department.currentHeadcount,
          0,
        ),
        teachersAssigned: teacherAssignmentCoverage.filter(
          (teacher) => teacher.coverageStatus === 'ASSIGNED',
        ).length,
        teacherCoverageIssues: teacherAssignmentCoverage.filter(
          (teacher) => teacher.requiresAttention,
        ).length,
      },
      statusCounts,
      categoryCounts,
      payrollEligibility,
      accessReconciliation,
      departmentHeadcount,
      teacherAssignmentCoverage,
      credentialAlerts: credentialResult.rows.map((row) => ({
        documentId: row.document_id,
        staffId: row.staff_id,
        staffCode: row.staff_code,
        firstName: row.first_name,
        lastName: row.last_name,
        documentType: row.document_type,
        displayName: row.display_name,
        expiresOn: row.expires_on,
        expiryStatus: row.expires_on < today ? 'EXPIRED' : 'EXPIRING_SOON',
      })),
      leaveQueue: leaveResult.rows.map((row) => ({
        leaveRequestId: row.leave_request_id,
        staffId: row.staff_id,
        staffCode: row.staff_code,
        firstName: row.first_name,
        lastName: row.last_name,
        leaveType: row.leave_type,
        status: row.request_status,
        startDate: row.start_date,
        endDate: row.end_date,
      })),
    };
  }
}
