import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { ListPlatformActivityDto } from './dto/list-platform-activity.dto';

type RecordActivityInput = {
  eventType: string;
  actorType?: string;
  actorUserId?: string | null;
  schoolId?: string | null;
  membershipId?: string | null;
  summary: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class PlatformActivityService {
  constructor(private readonly db: DbService) {}

  async record(input: RecordActivityInput) {
    await this.db.query(
      `
      INSERT INTO platform_activity_logs (
        event_type,
        actor_type,
        actor_user_id,
        school_id,
        membership_id,
        summary,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        input.eventType,
        input.actorType ?? 'SYSTEM',
        input.actorUserId ?? null,
        input.schoolId ?? null,
        input.membershipId ?? null,
        input.summary,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  }

  async recordTx(client: PoolClient, input: RecordActivityInput) {
    await client.query(
      `
      INSERT INTO platform_activity_logs (
        event_type,
        actor_type,
        actor_user_id,
        school_id,
        membership_id,
        summary,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        input.eventType,
        input.actorType ?? 'SYSTEM',
        input.actorUserId ?? null,
        input.schoolId ?? null,
        input.membershipId ?? null,
        input.summary,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  }

  async list(query: ListPlatformActivityDto) {
    const values: unknown[] = [];
    const where: string[] = ['1=1'];

    if (query.schoolId) {
      values.push(query.schoolId);
      where.push(`pal.school_id = $${values.length}`);
    }

    if (query.eventType?.trim()) {
      values.push(query.eventType.trim());
      where.push(`pal.event_type = $${values.length}`);
    }

    values.push(query.limit ?? 25);

    const result = await this.db.query<{
      id: string;
      event_type: string;
      actor_type: string;
      actor_user_id: string | null;
      school_id: string | null;
      school_name: string | null;
      membership_id: string | null;
      summary: string;
      payload: Record<string, unknown>;
      created_at: string;
    }>(
      `
      SELECT
        pal.id,
        pal.event_type,
        pal.actor_type,
        pal.actor_user_id,
        pal.school_id,
        s.name AS school_name,
        pal.membership_id,
        pal.summary,
        pal.payload,
        pal.created_at
      FROM platform_activity_logs pal
      LEFT JOIN schools s ON s.id = pal.school_id
      WHERE ${where.join(' AND ')}
      ORDER BY pal.created_at DESC
      LIMIT $${values.length}
      `,
      values,
    );

    return result.rows;
  }

  async summary() {
    const result = await this.db.query<{
      total_7d: string;
      school_creations_7d: string;
      staff_creations_7d: string;
      password_resets_7d: string;
      status_changes_7d: string;
    }>(
      `
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS total_7d,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
            AND event_type = 'SCHOOL_CREATED'
        )::text AS school_creations_7d,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
            AND event_type = 'STAFF_CREATED'
        )::text AS staff_creations_7d,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
            AND event_type = 'STAFF_PASSWORD_RESET'
        )::text AS password_resets_7d,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
            AND event_type IN (
              'SCHOOL_ACTIVATED',
              'SCHOOL_SUSPENDED',
              'SCHOOL_ARCHIVED',
              'SCHOOL_MANAGEMENT_MODE_CHANGED'
            )
        )::text AS status_changes_7d
      FROM platform_activity_logs
      `,
    );

    const row = result.rows[0];

    return {
      total7d: Number(row?.total_7d ?? 0),
      schoolCreations7d: Number(row?.school_creations_7d ?? 0),
      staffCreations7d: Number(row?.staff_creations_7d ?? 0),
      passwordResets7d: Number(row?.password_resets_7d ?? 0),
      statusChanges7d: Number(row?.status_changes_7d ?? 0),
    };
  }

  async recordManagedEntry(schoolId: string) {
    await this.record({
      eventType: 'MANAGED_WORKSPACE_OPENED',
      actorType: 'SUPERADMIN',
      schoolId,
      summary: 'Super Admin opened managed school workspace.',
      payload: {},
    });

    return { ok: true };
  }
}
