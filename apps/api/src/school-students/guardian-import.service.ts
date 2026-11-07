import { BadRequestException, Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { SchoolStudentsService } from './school-students.service';
import { GuardianImportDto } from './dto/guardian-import.dto';

type Guardian = {
  id: string;
  import_reference: string | null;
  full_name: string;
  email: string | null;
  phone_primary: string | null;
};
type Link = {
  student_id: string;
  guardian_id: string;
  relationship: string;
  is_primary_contact: boolean;
};
const clean = (value?: string | null) => value?.trim() || '';
const identity = (value: string) =>
  value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');

@Injectable()
export class GuardianImportService {
  constructor(
    private readonly db: DbService,
    private readonly students: SchoolStudentsService,
    private readonly activity: PlatformActivityService,
  ) {}

  private authorize(
    dto: GuardianImportDto,
    actor: string,
    role: 'SUPER_ADMIN' | null,
  ) {
    return this.students.assertUserCanAccessStudents(
      actor,
      dto.schoolId,
      role,
      ['SCHOOL_ADMIN'],
    );
  }

  // Preview and commit share this validation. Commit repeats it under locks;
  // the browser's earlier preview is never trusted as authorization or truth.
  private async inspect(client: PoolClient, dto: GuardianImportDto) {
    const students = (
      await client.query<{ id: string; code: string }>(
        `SELECT id, COALESCE(student_code,student_number) AS code FROM students
       WHERE school_id=$1 AND deleted_at IS NULL FOR UPDATE`,
        [dto.schoolId],
      )
    ).rows;
    const guardians = (
      await client.query<Guardian>(
        `SELECT id, import_reference, full_name, email, phone_primary FROM guardians
         WHERE school_id=$1 AND deleted_at IS NULL FOR UPDATE`,
        [dto.schoolId],
      )
    ).rows;
    const links = (
      await client.query<Link>(
        `SELECT student_id, guardian_id, relationship, is_primary_contact FROM student_guardians
       WHERE school_id=$1 AND deleted_at IS NULL`,
        [dto.schoolId],
      )
    ).rows;
    const references = new Map<string, string>();
    const pairs = new Set<string>();
    const primaries = new Map<string, string>();
    const rowNumbers = new Set<number>();
    const rows = dto.rows.map((input) => {
      const normalized = {
        guardianReference: clean(input.guardianReference).toUpperCase(),
        fullName: `${clean(input.firstName)} ${clean(input.lastName)}`.trim(),
        studentCode: clean(input.studentCode).toUpperCase(),
        email: clean(input.email).toLowerCase(),
        phone: clean(input.phone),
        relationship: clean(input.relationship).toUpperCase() || 'TUTOR',
        isPrimary: input.isPrimary ?? false,
      };
      const errors: string[] = [];
      if (rowNumbers.has(input.rowNumber)) errors.push('DUPLICATE_ROW');
      rowNumbers.add(input.rowNumber);
      if (!/^[A-Z0-9][A-Z0-9._-]{0,79}$/.test(normalized.guardianReference))
        errors.push('INVALID_REFERENCE');
      if (
        !clean(input.firstName) ||
        !clean(input.lastName) ||
        normalized.fullName.length > 200
      )
        errors.push('NAME_REQUIRED');
      if (!normalized.email && !normalized.phone)
        errors.push('CONTACT_REQUIRED');
      if (normalized.email && !isEmail(normalized.email))
        errors.push('INVALID_EMAIL');
      if (
        normalized.phone &&
        (!/^\+?[0-9 ()-]{5,50}$/.test(normalized.phone) ||
          normalized.phone.replace(/\D/g, '').length < 5)
      )
        errors.push('INVALID_PHONE');
      if (
        !['MOTHER', 'FATHER', 'TUTOR', 'OTHER'].includes(
          normalized.relationship,
        )
      )
        errors.push('INVALID_RELATIONSHIP');
      if (!normalized.studentCode && normalized.isPrimary)
        errors.push('STUDENT_REQUIRED');
      const fingerprint = JSON.stringify([
        identity(normalized.fullName),
        normalized.email,
        normalized.phone,
      ]);
      const previous = references.get(normalized.guardianReference);
      if (previous && previous !== fingerprint)
        errors.push('REFERENCE_CONFLICT');
      references.set(normalized.guardianReference, fingerprint);
      const guardian = guardians.find(
        (g) => g.import_reference === normalized.guardianReference,
      );
      if (
        guardian &&
        JSON.stringify([
          identity(guardian.full_name),
          clean(guardian.email).toLowerCase(),
          clean(guardian.phone_primary),
        ]) !== fingerprint
      )
        errors.push('EXISTING_DATA_CONFLICT');
      // Never infer identity from a name or silently attach a legacy guardian.
      if (
        !guardian &&
        guardians.some(
          (g) =>
            (normalized.email &&
              clean(g.email).toLowerCase() === normalized.email) ||
            (normalized.phone &&
              clean(g.phone_primary).replace(/[^0-9]/g, '') ===
                normalized.phone.replace(/[^0-9]/g, '')),
        )
      )
        errors.push('POSSIBLE_DUPLICATE');
      for (const [reference, value] of references) {
        if (reference !== normalized.guardianReference) {
          const [, email, phone] = JSON.parse(value) as string[];
          if (
            (normalized.email && email === normalized.email) ||
            (normalized.phone &&
              phone.replace(/[^0-9]/g, '') ===
                normalized.phone.replace(/[^0-9]/g, ''))
          )
            errors.push('POSSIBLE_DUPLICATE');
        }
      }
      const candidates = students.filter(
        (s) => s.code?.toUpperCase() === normalized.studentCode,
      );
      const student =
        normalized.studentCode && candidates.length === 1
          ? candidates[0]
          : null;
      if (normalized.studentCode && !student) errors.push('STUDENT_NOT_FOUND');
      const pair = `${normalized.guardianReference}:${normalized.studentCode}`;
      if (pairs.has(pair)) errors.push('DUPLICATE_LINK');
      pairs.add(pair);
      const existingLink =
        student && guardian
          ? links.find(
              (l) =>
                l.student_id === student.id && l.guardian_id === guardian.id,
            )
          : undefined;
      if (
        existingLink &&
        (existingLink.relationship !== normalized.relationship ||
          existingLink.is_primary_contact !== normalized.isPrimary)
      )
        errors.push('LINK_CONFLICT');
      if (student && normalized.isPrimary) {
        if (
          links.some(
            (l) =>
              l.student_id === student.id &&
              l.is_primary_contact &&
              l.guardian_id !== guardian?.id,
          )
        )
          errors.push('PRIMARY_CONFLICT');
        const primary = primaries.get(student.id);
        if (primary && primary !== normalized.guardianReference)
          errors.push('PRIMARY_CONFLICT');
        primaries.set(student.id, normalized.guardianReference);
      }
      return {
        rowNumber: input.rowNumber,
        normalized,
        errors: [...new Set(errors)],
        action: guardian ? 'REUSE' : 'CREATE',
        guardianId: guardian?.id ?? null,
        studentId: student?.id ?? null,
        linked: Boolean(existingLink),
      };
    });
    return {
      readyForImport: rows.every((r) => r.errors.length === 0),
      rows,
      summary: {
        totalRows: rows.length,
        validRows: rows.filter((r) => !r.errors.length).length,
        invalidRows: rows.filter((r) => r.errors.length).length,
      },
    };
  }

  async preview(
    dto: GuardianImportDto,
    actor: string,
    role: 'SUPER_ADMIN' | null,
  ) {
    await this.authorize(dto, actor, role);
    return this.db.withTransaction((client) => this.inspect(client, dto));
  }

  async commit(
    dto: GuardianImportDto,
    actor: string,
    role: 'SUPER_ADMIN' | null,
  ) {
    await this.authorize(dto, actor, role);
    return this.db.withTransaction(async (client) => {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`guardian-import:${dto.schoolId}`],
      );
      // Student/guardian row locks also coordinate with the single-record editor.
      const preview = await this.inspect(client, dto);
      if (!preview.readyForImport)
        throw new BadRequestException({
          message: 'GUARDIAN_IMPORT_INVALID',
          preview,
        });
      const ids = new Map<string, string>();
      let created = 0,
        linked = 0;
      for (const row of preview.rows) {
        const n = row.normalized;
        let id = row.guardianId ?? ids.get(n.guardianReference);
        if (!id) {
          const result = await client.query<{ id: string }>(
            `INSERT INTO guardians (school_id,import_reference,full_name,email,phone_primary)
             VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [
              dto.schoolId,
              n.guardianReference,
              n.fullName,
              n.email || null,
              n.phone || null,
            ],
          );
          id = result.rows[0].id;
          created++;
        }
        ids.set(n.guardianReference, id);
        if (row.studentId && !row.linked) {
          await client.query(
            `INSERT INTO student_guardians (school_id,student_id,guardian_id,relationship,relationship_type,
             is_primary_contact,is_primary,is_emergency_contact,is_authorized_pickup,can_pick_up)
             VALUES ($1,$2,$3,$4,$5,$6,$6,FALSE,FALSE,FALSE)`,
            [
              dto.schoolId,
              row.studentId,
              id,
              n.relationship,
              n.relationship,
              n.isPrimary,
            ],
          );
          linked++;
        }
      }
      await this.activity.recordTx(client, {
        eventType: 'GUARDIANS_IMPORTED',
        actorType: role === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId: actor,
        schoolId: dto.schoolId,
        summary: 'Guardian CSV import completed.',
        payload: { rows: preview.rows.length, created, linked },
      });
      return { imported: true, created, linked, reused: ids.size - created };
    });
  }
}
