import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { AssignStudentSectionDto } from './dto/assign-student-section.dto';
import { ChangeStudentStatusDto } from './dto/change-student-status.dto';
import { CreateSchoolStudentDto } from './dto/create-school-student.dto';
import { CreateStudentDocumentDto } from './dto/create-student-document.dto';
import { AddStudentGuardianDto } from './dto/add-student-guardian.dto';
import { UpdateSchoolStudentDto } from './dto/update-school-student.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { UpdateStudentDocumentDto } from './dto/update-student-document.dto';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';

@Injectable()
export class SchoolStudentsService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  async assertUserCanAccessStudents(
    actorUserId: string,
    schoolId: string,
    platformRole: 'SUPER_ADMIN' | null,
    allowedRoles: string[],
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
        AND EXISTS (
          SELECT 1
          FROM school_staff_accounts staff
          WHERE staff.school_id = sm.school_id
            AND staff.user_id = sm.user_id
            AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
            AND staff.deleted_at IS NULL
        )
      `,
      [actorUserId, schoolId],
    );

    const roles = membershipResult.rows.map((row) => row.role);
    const hasAllowedRole = roles.some((role) => allowedRoles.includes(role));

    if (!hasAllowedRole) {
      throw new ForbiddenException(
        'You do not have permission to manage students.',
      );
    }
  }

  private async getFinanceCapabilities(
    actorUserId: string,
    schoolId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    if (platformRole === 'SUPER_ADMIN') {
      return {
        canViewFinance: true,
        canCreateInvoices: true,
        canRecordPayments: true,
      };
    }

    const rolesResult = await this.db.query<{ role: string }>(
      `
      SELECT smr.role::text AS role
      FROM school_memberships sm
      JOIN school_membership_roles smr
        ON smr.school_membership_id = sm.id
       AND smr.deleted_at IS NULL
      WHERE sm.school_id = $1
        AND sm.user_id = $2
        AND sm.membership_status = 'ACTIVE'
        AND EXISTS (
          SELECT 1
          FROM school_staff_accounts staff
          WHERE staff.school_id = sm.school_id
            AND staff.user_id = sm.user_id
            AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
            AND staff.deleted_at IS NULL
        )
        AND sm.deleted_at IS NULL
      `,
      [schoolId, actorUserId],
    );
    const roles = rolesResult.rows.map((row) => row.role);
    if (roles.includes('SCHOOL_ADMIN')) {
      return {
        canViewFinance: true,
        canCreateInvoices: true,
        canRecordPayments: true,
      };
    }
    if (!roles.includes('FINANCE_ADMIN')) {
      return {
        canViewFinance: false,
        canCreateInvoices: false,
        canRecordPayments: false,
      };
    }

    const permissionsResult = await this.db.query<{
      permission_code: string;
    }>(
      `
      SELECT permission_code
      FROM school_user_permissions
      WHERE school_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      `,
      [schoolId, actorUserId],
    );
    const permissions = new Set(
      permissionsResult.rows.map((row) => row.permission_code),
    );
    return {
      canViewFinance: permissions.has('FINANCE_INVOICES_VIEW'),
      canCreateInvoices: permissions.has('FINANCE_INVOICES_CREATE'),
      canRecordPayments: permissions.has('FINANCE_PAYMENTS_RECORD'),
    };
  }

  async listStudents(query: {
    schoolId: string;
    search?: string;
    status?: string;
    sectionId?: string;
  }) {
    const search = query.search?.trim().toLowerCase() ?? '';

    const result = await this.db.query<{
      id: string;
      student_code: string | null;
      student_status: string | null;
      first_name: string | null;
      last_name: string | null;
      section_id: string | null;
      section_code: string | null;
      section_name_i18n: Record<string, string> | null;
      grade_level_id: string | null;
      grade_level_code: string | null;
      grade_level_name_i18n: Record<string, string> | null;
      academic_division: string | null;
      created_at: string;
    }>(
      `
      SELECT
        st.id,
        COALESCE(st.student_code, st.student_number) AS student_code,
        st.status::text AS student_status,
        st.first_name,
        st.last_name,
        current_enrollment.section_id,
        current_enrollment.section_code,
        current_enrollment.section_name_i18n,
        current_enrollment.grade_level_id,
        current_enrollment.grade_level_code,
        current_enrollment.grade_level_name_i18n,
        current_enrollment.academic_division,
        st.created_at::text AS created_at
      FROM students st
      LEFT JOIN LATERAL (
        SELECT
          en.id AS enrollment_id,
          se.id AS section_id,
          se.code AS section_code,
          se.name_i18n AS section_name_i18n,
          gl.id AS grade_level_id,
          gl.code AS grade_level_code,
          gl.name_i18n AS grade_level_name_i18n,
          gl.academic_division
        FROM enrollments en
        JOIN sections se
          ON se.id = en.section_id
         AND se.deleted_at IS NULL
        JOIN grade_levels gl
          ON gl.id = se.grade_level_id
         AND gl.deleted_at IS NULL
        WHERE en.student_id = st.id
          AND en.deleted_at IS NULL
          AND en.enrollment_status = 'ACTIVE'
        ORDER BY en.created_at DESC
        LIMIT 1
      ) current_enrollment ON TRUE
      WHERE st.school_id = $1
        AND st.deleted_at IS NULL
        AND ($3::text IS NULL OR st.status::text = $3::text)
        AND ($4::uuid IS NULL OR current_enrollment.section_id = $4::uuid)
        AND (
          $2 = ''
          OR LOWER(COALESCE(st.first_name, '')) LIKE '%' || $2 || '%'
          OR LOWER(COALESCE(st.last_name, '')) LIKE '%' || $2 || '%'
          OR LOWER(COALESCE(st.student_code, st.student_number, '')) LIKE '%' || $2 || '%'
          OR LOWER(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) LIKE '%' || $2 || '%'
        )
      ORDER BY st.created_at DESC
      LIMIT 200
      `,
      [query.schoolId, search, query.status ?? null, query.sectionId ?? null],
    );

    return result.rows.map((row) => ({
      id: row.id,
      studentCode: row.student_code,
      studentStatus: row.student_status,
      firstName: row.first_name,
      lastName: row.last_name,
      gradeLevelCode: row.grade_level_code,
      gradeLevelNameI18n: row.grade_level_name_i18n,
      sectionCode: row.section_code,
      sectionNameI18n: row.section_name_i18n,
      currentEnrollment: row.section_id
        ? {
            section: {
              id: row.section_id,
              code: row.section_code,
              nameI18n: row.section_name_i18n,
            },
            gradeLevel: {
              id: row.grade_level_id,
              code: row.grade_level_code,
              nameI18n: row.grade_level_name_i18n,
              academicDivision: row.academic_division,
            },
          }
        : null,
      createdAt: row.created_at,
    }));
  }

  async getStudentDetails(
    input: {
      schoolId: string;
      studentId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessStudents(
      actorUserId,
      input.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN'],
    );

    const studentResult = await this.db.query<{
      id: string;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
      student_status: string | null;
      gender: string | null;
      date_of_birth: string | null;
      place_of_birth: string | null;
      photo_url: string | null;
      previous_school_name: string | null;
      previous_school_address: string | null;
      photo_received: boolean;
      birth_certificate_received: boolean;
      vaccination_card_received: boolean;
      previous_school_record_received: boolean;
      vaccination_status: string | null;
      allergies: string | null;
      medical_notes: string | null;
      special_needs: string | null;
      health_notes: string | null;
      allergy_notes: string | null;
      created_at: string;
      grade_level_code: string | null;
      grade_level_name_i18n: Record<string, string> | null;
      section_id: string | null;
      section_code: string | null;
      section_name_i18n: Record<string, string> | null;
    }>(
      `
      SELECT
        st.id,
        COALESCE(st.student_code, st.student_number) AS student_code,
        st.first_name,
        st.last_name,
        st.status::text AS student_status,
        st.gender,
        st.date_of_birth::text AS date_of_birth,
        st.place_of_birth,
        st.photo_url,
        st.previous_school_name,
        st.previous_school_address,
        st.photo_received,
        st.birth_certificate_received,
        st.vaccination_card_received,
        st.previous_school_record_received,
        st.vaccination_status,
        st.allergies,
        st.medical_notes,
        st.special_needs,
        st.health_notes,
        st.allergy_notes,
        st.created_at::text AS created_at,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n,
        se.id AS section_id,
        se.code AS section_code,
        se.name_i18n AS section_name_i18n
      FROM students st
      LEFT JOIN LATERAL (
        SELECT en.section_id
        FROM enrollments en
        WHERE en.student_id = st.id
          AND en.deleted_at IS NULL
          AND en.enrollment_status = 'ACTIVE'
        ORDER BY en.created_at DESC
        LIMIT 1
      ) active_en ON TRUE
      LEFT JOIN sections se
        ON se.id = active_en.section_id
       AND se.deleted_at IS NULL
      LEFT JOIN grade_levels gl
        ON gl.id = se.grade_level_id
       AND gl.deleted_at IS NULL
      WHERE st.id = $1
        AND st.school_id = $2
        AND st.deleted_at IS NULL
      LIMIT 1
      `,
      [input.studentId, input.schoolId],
    );

    const student = studentResult.rows[0];

    if (!student) {
      throw new NotFoundException('Student not found for this school.');
    }

    const financeCapabilities = await this.getFinanceCapabilities(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const financeResult = await this.db.query<{
      invoice_count: string;
      overdue_count: string;
    }>(
      `
      SELECT
        COUNT(*)::text AS invoice_count,
        COUNT(*) FILTER (
          WHERE balance_due > 0
            AND due_date IS NOT NULL
            AND due_date < CURRENT_DATE
            AND invoice_status NOT IN ('PAID', 'VOID')
        )::text AS overdue_count
      FROM invoices
      WHERE school_id = $1
        AND student_id = $2
        AND deleted_at IS NULL
        AND $3::boolean
      `,
      [input.schoolId, input.studentId, financeCapabilities.canViewFinance],
    );

    const financeMoneyResult = await this.db.query<{
      currency_code: string;
      total_billed: string;
      total_paid: string;
      total_outstanding: string;
    }>(
      `
      SELECT
        currency_code,
        COALESCE(SUM(total_amount), 0)::text AS total_billed,
        COALESCE(SUM(amount_paid), 0)::text AS total_paid,
        COALESCE(SUM(balance_due), 0)::text AS total_outstanding
      FROM invoices
      WHERE school_id = $1
        AND student_id = $2
        AND deleted_at IS NULL
        AND invoice_status <> 'VOID'
        AND $3::boolean
      GROUP BY currency_code
      ORDER BY currency_code
      `,
      [input.schoolId, input.studentId, financeCapabilities.canViewFinance],
    );

    const recentInvoicesResult = await this.db.query<{
      id: string;
      invoice_number: string | null;
      invoice_status: string;
      issue_date: string;
      due_date: string | null;
      total_amount: string;
      amount_paid: string;
      balance_due: string;
      currency_code: string;
    }>(
      `
      SELECT
        id,
        invoice_number,
        invoice_status::text AS invoice_status,
        issue_date::text AS issue_date,
        due_date::text AS due_date,
        total_amount::text AS total_amount,
        amount_paid::text AS amount_paid,
        balance_due::text AS balance_due,
        currency_code
      FROM invoices
      WHERE school_id = $1
        AND student_id = $2
        AND deleted_at IS NULL
        AND $3::boolean
      ORDER BY created_at DESC
      LIMIT 5
      `,
      [input.schoolId, input.studentId, financeCapabilities.canViewFinance],
    );

    const recentPaymentsResult = await this.db.query<{
      id: string;
      receipt_number: string | null;
      invoice_id: string | null;
      invoice_number: string | null;
      payment_status: string;
      payment_date: string;
      amount: string;
      currency_code: string;
      method: string | null;
      reference: string | null;
    }>(
      `
      SELECT
        pay.id,
        pay.receipt_number,
        pay.invoice_id,
        inv.invoice_number,
        pay.payment_status::text AS payment_status,
        pay.payment_date::text AS payment_date,
        pay.amount::text AS amount,
        pay.currency_code,
        pay.method,
        pay.reference
      FROM payments pay
      LEFT JOIN invoices inv ON inv.id = pay.invoice_id
      WHERE pay.school_id = $1
        AND pay.student_id = $2
        AND pay.deleted_at IS NULL
        AND $3::boolean
      ORDER BY pay.payment_date DESC, pay.created_at DESC
      LIMIT 5
      `,
      [input.schoolId, input.studentId, financeCapabilities.canViewFinance],
    );

    const documentRecordsResult = await this.db.query<{
      id: string;
      document_type: string;
      document_status: string;
      file_name: string | null;
      file_url: string | null;
      received_at: string | null;
      verified_at: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `
      SELECT
        id,
        document_type,
        document_status,
        file_name,
        file_url,
        received_at::text AS received_at,
        verified_at::text AS verified_at,
        notes,
        created_at::text AS created_at
      FROM student_documents
      WHERE school_id = $1
        AND student_id = $2
        AND deleted_at IS NULL
      ORDER BY
        CASE document_type
          WHEN 'PHOTO' THEN 1
          WHEN 'BIRTH_CERTIFICATE' THEN 2
          WHEN 'VACCINATION_CARD' THEN 3
          WHEN 'PREVIOUS_SCHOOL_RECORD' THEN 4
          ELSE 5
        END,
        created_at DESC
      `,
      [input.schoolId, input.studentId],
    );
    const guardiansResult = await this.db.query<{
      student_guardian_id: string;
      guardian_id: string;
      relationship: string;
      is_primary_contact: boolean;
      is_emergency_contact: boolean;
      is_authorized_pickup: boolean;
      full_name: string;
      profession: string | null;
      phone_primary: string | null;
      phone_secondary: string | null;
      email: string | null;
      address: string | null;
    }>(
      `
      SELECT
        sg.id AS student_guardian_id,
        g.id AS guardian_id,
        COALESCE(sg.relationship, sg.relationship_type) AS relationship,
        sg.is_primary_contact,
        sg.is_emergency_contact,
        sg.is_authorized_pickup,
        g.full_name,
        g.profession,
        g.phone_primary,
        g.phone_secondary,
        g.email,
        g.address
      FROM student_guardians sg
      JOIN guardians g ON g.id = sg.guardian_id
      WHERE sg.school_id = $1
        AND sg.student_id = $2
        AND sg.deleted_at IS NULL
        AND g.deleted_at IS NULL
      ORDER BY
        CASE COALESCE(sg.relationship, sg.relationship_type)
          WHEN 'MOTHER' THEN 1
          WHEN 'FATHER' THEN 2
          WHEN 'TUTOR' THEN 3
          ELSE 4
        END,
        g.full_name ASC
      `,
      [input.schoolId, input.studentId],
    );
    const currentEnrollmentResult = await this.db.query<{
      enrollment_id: string;
      enrollment_status: string;
      section_id: string;
      section_code: string;
      section_name_i18n: Record<string, string> | null;
      grade_level_id: string;
      grade_level_code: string;
      grade_level_name_i18n: Record<string, string> | null;
      academic_division: string | null;
    }>(
      `
      SELECT
        en.id AS enrollment_id,
        en.enrollment_status,
        se.id AS section_id,
        se.code AS section_code,
        se.name_i18n AS section_name_i18n,
        gl.id AS grade_level_id,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n,
        gl.academic_division
      FROM enrollments en
      JOIN sections se
        ON se.id = en.section_id
       AND se.deleted_at IS NULL
      JOIN grade_levels gl
        ON gl.id = se.grade_level_id
       AND gl.deleted_at IS NULL
      WHERE en.student_id = $1
        AND en.deleted_at IS NULL
        AND en.enrollment_status = 'ACTIVE'
      ORDER BY en.created_at DESC
      LIMIT 1
      `,
      [input.studentId],
    );

    const enrollmentHistoryResult = await this.db.query<{
      enrollment_id: string;
      enrollment_status: string;
      section_id: string;
      section_code: string;
      section_name_i18n: Record<string, string> | null;
      grade_level_id: string;
      grade_level_code: string;
      grade_level_name_i18n: Record<string, string> | null;
      academic_division: string | null;
      created_at: string;
      updated_at: string | null;
      ended_at: string | null;
    }>(
      `
      SELECT
        en.id AS enrollment_id,
        en.enrollment_status,
        se.id AS section_id,
        se.code AS section_code,
        se.name_i18n AS section_name_i18n,
        gl.id AS grade_level_id,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n,
        gl.academic_division,
        en.created_at::text AS created_at,
        en.updated_at::text AS updated_at,
        en.deleted_at::text AS ended_at
      FROM enrollments en
      JOIN sections se
        ON se.id = en.section_id
      JOIN grade_levels gl
        ON gl.id = se.grade_level_id
      WHERE en.student_id = $1
      ORDER BY
        en.created_at DESC
      LIMIT 50
      `,
      [input.studentId],
    );

    const admissionSourceResult = await this.db.query<{
      id: string;
      application_number: string;
      admission_status: string;
      first_name: string;
      last_name: string;
      created_at: string;
    }>(
      `
      SELECT
        id,
        application_number,
        admission_status,
        first_name,
        last_name,
        created_at::text AS created_at
      FROM admission_applications
      WHERE school_id = $1
        AND converted_student_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.schoolId, input.studentId],
    );

    const statusHistoryResult = await this.db.query<{
      id: string;
      previous_status: string | null;
      new_status: string;
      reason: string | null;
      changed_by_user_id: string | null;
      changed_at: string;
    }>(
      `
      SELECT
        id,
        previous_status,
        new_status,
        reason,
        changed_by_user_id,
        changed_at::text AS changed_at
      FROM student_status_history
      WHERE school_id = $1
        AND student_id = $2
        AND deleted_at IS NULL
      ORDER BY changed_at DESC
      LIMIT 50
      `,
      [input.schoolId, input.studentId],
    );

    const finance = financeResult.rows[0];

    return {
      schoolId: input.schoolId,
      student: {
        id: student.id,
        studentCode: student.student_code,
        firstName: student.first_name,
        lastName: student.last_name,
        studentStatus: student.student_status,
        gender: student.gender,
        dateOfBirth: student.date_of_birth,
        placeOfBirth: student.place_of_birth,
        photoUrl: student.photo_url,
        previousSchoolName: student.previous_school_name,
        previousSchoolAddress: student.previous_school_address,
        photoReceived: student.photo_received,
        birthCertificateReceived: student.birth_certificate_received,
        vaccinationCardReceived: student.vaccination_card_received,
        previousSchoolRecordReceived: student.previous_school_record_received,
        healthNotes: student.health_notes,
        allergyNotes: student.allergy_notes,
        medicalNotes: student.medical_notes,
        createdAt: student.created_at,
      },
      admissionSource: admissionSourceResult.rows[0]
        ? {
            id: admissionSourceResult.rows[0].id,
            applicationNumber: admissionSourceResult.rows[0].application_number,
            admissionStatus: admissionSourceResult.rows[0].admission_status,
            firstName: admissionSourceResult.rows[0].first_name,
            lastName: admissionSourceResult.rows[0].last_name,
            createdAt: admissionSourceResult.rows[0].created_at,
          }
        : null,
      documents: {
        photoReceived: student.photo_received,
        birthCertificateReceived: student.birth_certificate_received,
        vaccinationCardReceived: student.vaccination_card_received,
        previousSchoolRecordReceived: student.previous_school_record_received,
      },
      health: {
        vaccinationStatus: student.vaccination_status,
        allergies: student.allergies,
        medicalNotes: student.medical_notes,
        specialNeeds: student.special_needs,
      },
      documentRecords: documentRecordsResult.rows.map((row) => ({
        id: row.id,
        documentType: row.document_type,
        documentStatus: row.document_status,
        fileName: row.file_name,
        fileUrl: row.file_url,
        receivedAt: row.received_at,
        verifiedAt: row.verified_at,
        notes: row.notes,
        createdAt: row.created_at,
      })),
      guardians: guardiansResult.rows.map((row) => ({
        studentGuardianId: row.student_guardian_id,
        guardianId: row.guardian_id,
        relationship: row.relationship,
        isPrimaryContact: row.is_primary_contact,
        isEmergencyContact: row.is_emergency_contact,
        isAuthorizedPickup: row.is_authorized_pickup,
        fullName: row.full_name,
        profession: row.profession,
        phonePrimary: row.phone_primary,
        phoneSecondary: row.phone_secondary,
        email: row.email,
        address: row.address,
      })),
      currentEnrollment: currentEnrollmentResult.rows[0]
        ? {
            enrollmentId: currentEnrollmentResult.rows[0].enrollment_id,
            enrollmentStatus: currentEnrollmentResult.rows[0].enrollment_status,
            section: {
              id: currentEnrollmentResult.rows[0].section_id,
              code: currentEnrollmentResult.rows[0].section_code,
              nameI18n: currentEnrollmentResult.rows[0].section_name_i18n,
            },
            gradeLevel: {
              id: currentEnrollmentResult.rows[0].grade_level_id,
              code: currentEnrollmentResult.rows[0].grade_level_code,
              nameI18n: currentEnrollmentResult.rows[0].grade_level_name_i18n,
              academicDivision:
                currentEnrollmentResult.rows[0].academic_division,
            },
          }
        : null,
      enrollmentHistory: enrollmentHistoryResult.rows.map((row) => ({
        enrollmentId: row.enrollment_id,
        enrollmentStatus: row.enrollment_status,
        section: {
          id: row.section_id,
          code: row.section_code,
          nameI18n: row.section_name_i18n,
        },
        gradeLevel: {
          id: row.grade_level_id,
          code: row.grade_level_code,
          nameI18n: row.grade_level_name_i18n,
          academicDivision: row.academic_division,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        endedAt: row.ended_at,
      })),
      statusHistory: statusHistoryResult.rows.map((row) => ({
        id: row.id,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        reason: row.reason,
        changedByUserId: row.changed_by_user_id,
        changedAt: row.changed_at,
      })),
      capabilities: financeCapabilities,
      finance: financeCapabilities.canViewFinance
        ? {
            invoiceCount: Number(finance.invoice_count),
            overdueCount: Number(finance.overdue_count),
            totalsByCurrency: financeMoneyResult.rows.map((row) => ({
              currencyCode: row.currency_code,
              totalBilled: Number(row.total_billed),
              totalPaid: Number(row.total_paid),
              totalOutstanding: Number(row.total_outstanding),
            })),
          }
        : null,
      recentInvoices: recentInvoicesResult.rows.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        invoiceStatus: row.invoice_status,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        totalAmount: Number(row.total_amount),
        amountPaid: Number(row.amount_paid),
        balanceDue: Number(row.balance_due),
        currencyCode: row.currency_code,
      })),
      recentPayments: recentPaymentsResult.rows.map((row) => ({
        id: row.id,
        receiptNumber: row.receipt_number,
        invoiceId: row.invoice_id,
        invoiceNumber: row.invoice_number,
        paymentStatus: row.payment_status,
        paymentDate: row.payment_date,
        amount: Number(row.amount),
        currencyCode: row.currency_code,
        method: row.method,
        reference: row.reference,
      })),
    };
  }

  async assignStudentSection(
    studentId: string,
    dto: AssignStudentSectionDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessStudents(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const studentResult = await client.query<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        student_status: string;
      }>(
        `
        SELECT id, first_name, last_name, status::text AS student_status
        FROM students
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [studentId, dto.schoolId],
      );

      const student = studentResult.rows[0];

      if (!student) {
        throw new NotFoundException('Student not found for this school.');
      }

      const sectionResult = await client.query<{
        id: string;
        code: string;
        name_i18n: Record<string, string> | null;
        academic_year_id: string;
        grade_level_id: string;
        grade_level_code: string;
        grade_level_name_i18n: Record<string, string> | null;
        start_date: string;
      }>(
        `
        SELECT
          se.id,
          se.code,
          se.name_i18n,
          se.academic_year_id,
          gl.id AS grade_level_id,
          gl.code AS grade_level_code,
          gl.name_i18n AS grade_level_name_i18n,
          GREATEST(ay.start_date, CURRENT_DATE)::text AS start_date
        FROM sections se
        JOIN academic_years ay
          ON ay.id = se.academic_year_id
         AND ay.deleted_at IS NULL
        JOIN grade_levels gl
          ON gl.id = se.grade_level_id
         AND gl.deleted_at IS NULL
        WHERE se.id = $1
          AND se.school_id = $2
          AND se.deleted_at IS NULL
        LIMIT 1
        `,
        [dto.sectionId, dto.schoolId],
      );

      const section = sectionResult.rows[0];

      if (!section) {
        throw new NotFoundException('Section not found for this school.');
      }

      const currentEnrollmentResult = await client.query<{
        id: string;
        section_id: string;
      }>(
        `
        SELECT id, section_id
        FROM enrollments
        WHERE student_id = $1
          AND deleted_at IS NULL
          AND enrollment_status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [studentId],
      );

      const currentEnrollment = currentEnrollmentResult.rows[0];

      if (currentEnrollment?.section_id === dto.sectionId) {
        return {
          studentId,
          sectionId: dto.sectionId,
          unchanged: true,
        };
      }

      await client.query(
        `
        UPDATE enrollments
        SET
          enrollment_status = 'TRANSFERRED',
          end_date = CURRENT_DATE,
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE student_id = $1
          AND deleted_at IS NULL
          AND enrollment_status = 'ACTIVE'
        `,
        [studentId],
      );

      const enrollmentResult = await client.query<{
        id: string;
      }>(
        `
        INSERT INTO enrollments (
          student_id,
          academic_year_id,
          grade_level_id,
          section_id,
          enrollment_status,
          start_date
        )
        VALUES ($1, $2, $3, $4, 'ACTIVE', $5::date)
        RETURNING id
        `,
        [
          studentId,
          section.academic_year_id,
          section.grade_level_id,
          dto.sectionId,
          section.start_date,
        ],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_SECTION_ASSIGNED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary:
          `Student ${student.first_name ?? ''} ${student.last_name ?? ''} assigned to section ${section.code}.`.trim(),
        payload: {
          studentId,
          previousEnrollmentId: currentEnrollment?.id ?? null,
          previousSectionId: currentEnrollment?.section_id ?? null,
          newEnrollmentId: enrollmentResult.rows[0].id,
          newSectionId: dto.sectionId,
          sectionCode: section.code,
          reason: dto.reason?.trim() || null,
        },
      });

      return {
        studentId,
        enrollmentId: enrollmentResult.rows[0].id,
        section: {
          id: section.id,
          code: section.code,
          nameI18n: section.name_i18n,
        },
        gradeLevel: {
          id: section.grade_level_id,
          code: section.grade_level_code,
          nameI18n: section.grade_level_name_i18n,
        },
      };
    });
  }
  async changeStudentStatus(
    studentId: string,
    dto: ChangeStudentStatusDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessStudents(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const studentResult = await client.query<{
        id: string;
        student_code: string | null;
        first_name: string | null;
        last_name: string | null;
        student_status: string;
      }>(
        `
        SELECT
          id,
          COALESCE(student_code, student_number) AS student_code,
          first_name,
          last_name,
          status::text AS student_status
        FROM students
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [studentId, dto.schoolId],
      );

      const student = studentResult.rows[0];

      if (!student) {
        throw new NotFoundException('Student not found for this school.');
      }

      if (student.student_status === dto.newStatus) {
        return {
          id: student.id,
          studentCode: student.student_code,
          studentStatus: student.student_status,
          unchanged: true,
        };
      }

      if (dto.newStatus === 'ACTIVE') {
        const activeEnrollmentResult = await client.query(
          `
          SELECT id
          FROM enrollments
          WHERE student_id = $1
            AND deleted_at IS NULL
            AND enrollment_status = 'ACTIVE'
          LIMIT 1
          `,
          [studentId],
        );

        if (!activeEnrollmentResult.rows[0]) {
          throw new BadRequestException(
            'Student must have an active section/class assignment before becoming ACTIVE.',
          );
        }
      }

      const updatedResult = await client.query<{
        id: string;
        student_code: string | null;
        student_status: string;
      }>(
        `
        UPDATE students
        SET
          status = $3::student_status,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        RETURNING
          id,
          COALESCE(student_code, student_number) AS student_code,
          status::text AS student_status
        `,
        [studentId, dto.schoolId, dto.newStatus],
      );

      const updated = updatedResult.rows[0];
      const reason = dto.reason?.trim() || null;

      await client.query(
        `
        INSERT INTO student_status_history (
          school_id,
          student_id,
          previous_status,
          new_status,
          reason,
          changed_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          dto.schoolId,
          studentId,
          student.student_status,
          dto.newStatus,
          reason,
          actorUserId,
        ],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_STATUS_CHANGED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Student ${student.student_code ?? student.id} status changed from ${student.student_status} to ${dto.newStatus}.`,
        payload: {
          studentId,
          studentCode: student.student_code,
          previousStatus: student.student_status,
          newStatus: dto.newStatus,
          reason,
        },
      });

      return {
        id: updated.id,
        studentCode: updated.student_code,
        studentStatus: updated.student_status,
        previousStatus: student.student_status,
        reason,
      };
    });
  }
  async updateStudent(
    studentId: string,
    dto: UpdateSchoolStudentDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessStudents(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const existingResult = await client.query<{
        id: string;
        student_code: string | null;
        first_name: string | null;
        last_name: string | null;
        gender: string | null;
        date_of_birth: string | null;
        place_of_birth: string | null;
        photo_url: string | null;
        previous_school_name: string | null;
        previous_school_address: string | null;
        photo_received: boolean;
        birth_certificate_received: boolean;
        vaccination_card_received: boolean;
        previous_school_record_received: boolean;
        vaccination_status: string | null;
        allergies: string | null;
        medical_notes: string | null;
        special_needs: string | null;
      }>(
        `
        SELECT
          id,
          student_code,
          first_name,
          last_name,
          gender,
          date_of_birth::text AS date_of_birth,
          place_of_birth,
          photo_url,
          previous_school_name,
          previous_school_address,
          photo_received,
          birth_certificate_received,
          vaccination_card_received,
          previous_school_record_received,
          vaccination_status,
          allergies,
          medical_notes,
          special_needs
        FROM students
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [studentId, dto.schoolId],
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        throw new NotFoundException('Student not found for this school.');
      }

      const nextFirstName =
        dto.firstName !== undefined
          ? dto.firstName.trim()
          : existing.first_name;

      const nextLastName =
        dto.lastName !== undefined ? dto.lastName.trim() : existing.last_name;

      const nextStudentCode =
        dto.studentCode !== undefined
          ? dto.studentCode.trim() || null
          : existing.student_code;

      if (!nextFirstName || !nextLastName) {
        throw new BadRequestException('First name and last name are required.');
      }

      const updatedResult = await client.query<{
        id: string;
        student_code: string | null;
        first_name: string | null;
        last_name: string | null;
      }>(
        `
        UPDATE students
        SET
          first_name = $3,
          last_name = $4,
          student_code = $5,
          gender = $6,
          date_of_birth = $7::date,
          place_of_birth = $8,
          photo_url = $9,
          previous_school_name = $10,
          previous_school_address = $11,
          photo_received = $12,
          birth_certificate_received = $13,
          vaccination_card_received = $14,
          previous_school_record_received = $15,
          vaccination_status = $16,
          allergies = $17,
          medical_notes = $18,
          special_needs = $19,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        RETURNING
          id,
          student_code,
          first_name,
          last_name
        `,
        [
          studentId,
          dto.schoolId,
          nextFirstName,
          nextLastName,
          nextStudentCode,
          dto.gender !== undefined ? dto.gender : existing.gender,
          dto.dateOfBirth !== undefined
            ? dto.dateOfBirth
            : existing.date_of_birth,
          dto.placeOfBirth !== undefined
            ? dto.placeOfBirth.trim() || null
            : existing.place_of_birth,
          dto.photoUrl !== undefined
            ? dto.photoUrl.trim() || null
            : existing.photo_url,
          dto.previousSchoolName !== undefined
            ? dto.previousSchoolName.trim() || null
            : existing.previous_school_name,
          dto.previousSchoolAddress !== undefined
            ? dto.previousSchoolAddress.trim() || null
            : existing.previous_school_address,
          dto.photoReceived !== undefined
            ? dto.photoReceived
            : existing.photo_received,
          dto.birthCertificateReceived !== undefined
            ? dto.birthCertificateReceived
            : existing.birth_certificate_received,
          dto.vaccinationCardReceived !== undefined
            ? dto.vaccinationCardReceived
            : existing.vaccination_card_received,
          dto.previousSchoolRecordReceived !== undefined
            ? dto.previousSchoolRecordReceived
            : existing.previous_school_record_received,
          dto.vaccinationStatus !== undefined
            ? dto.vaccinationStatus.trim() || null
            : existing.vaccination_status,
          dto.allergies !== undefined
            ? dto.allergies.trim() || null
            : existing.allergies,
          dto.medicalNotes !== undefined
            ? dto.medicalNotes.trim() || null
            : existing.medical_notes,
          dto.specialNeeds !== undefined
            ? dto.specialNeeds.trim() || null
            : existing.special_needs,
        ],
      );

      const updated = updatedResult.rows[0];
      let nextSectionId: string | null = null;

      if (dto.clearSection) {
        await client.query(
          `
          UPDATE enrollments
          SET
            deleted_at = NOW(),
            updated_at = NOW()
          WHERE student_id = $1
            AND deleted_at IS NULL
            AND enrollment_status = 'ACTIVE'
          `,
          [studentId],
        );
      } else if (dto.sectionId) {
        const sectionResult = await client.query<{
          id: string;
          academic_year_id: string;
          grade_level_id: string;
          start_date: string;
        }>(
          `
          SELECT
            se.id,
            se.academic_year_id,
            se.grade_level_id,
            GREATEST(ay.start_date, CURRENT_DATE)::text AS start_date
          FROM sections se
          JOIN academic_years ay
            ON ay.id = se.academic_year_id
           AND ay.deleted_at IS NULL
          WHERE se.id = $1
            AND se.school_id = $2
            AND se.deleted_at IS NULL
          LIMIT 1
          `,
          [dto.sectionId, dto.schoolId],
        );

        const section = sectionResult.rows[0];

        if (!section) {
          throw new NotFoundException('Section not found for this school.');
        }

        const activeEnrollmentResult = await client.query<{
          section_id: string;
        }>(
          `
          SELECT section_id
          FROM enrollments
          WHERE student_id = $1
            AND deleted_at IS NULL
            AND enrollment_status = 'ACTIVE'
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [studentId],
        );

        const activeEnrollment = activeEnrollmentResult.rows[0];

        if (
          !activeEnrollment ||
          activeEnrollment.section_id !== dto.sectionId
        ) {
          await client.query(
            `
            UPDATE enrollments
            SET
              deleted_at = NOW(),
              updated_at = NOW()
            WHERE student_id = $1
              AND deleted_at IS NULL
              AND enrollment_status = 'ACTIVE'
            `,
            [studentId],
          );

          await client.query(
            `
            INSERT INTO enrollments (
              student_id,
              academic_year_id,
              grade_level_id,
              section_id,
              enrollment_status,
              start_date
            )
            VALUES ($1, $2, $3, $4, 'ACTIVE', $5::date)
            `,
            [
              studentId,
              section.academic_year_id,
              section.grade_level_id,
              section.id,
              section.start_date,
            ],
          );
        }

        nextSectionId = section.id;
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_UPDATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary:
          `Student ${updated.first_name ?? ''} ${updated.last_name ?? ''} updated.`.trim(),
        payload: {
          studentId,
          studentCode: updated.student_code,
          sectionId: nextSectionId,
          clearSection: dto.clearSection ?? false,
        },
      });

      return {
        id: updated.id,
        studentCode: updated.student_code,
        firstName: updated.first_name,
        lastName: updated.last_name,
        sectionId: nextSectionId,
        clearSection: dto.clearSection ?? false,
      };
    });
  }

  async updateStudentProfile(
    studentId: string,
    dto: UpdateStudentProfileDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessStudents(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const existingResult = await client.query<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        gender: string | null;
        date_of_birth: string | null;
        place_of_birth: string | null;
        previous_school_name: string | null;
        previous_school_address: string | null;
        photo_received: boolean;
        birth_certificate_received: boolean;
        vaccination_card_received: boolean;
        previous_school_record_received: boolean;
        health_notes: string | null;
        allergy_notes: string | null;
        medical_notes: string | null;
      }>(
        `
        SELECT
          id,
          first_name,
          last_name,
          gender,
          date_of_birth::text AS date_of_birth,
          place_of_birth,
          previous_school_name,
          previous_school_address,
          photo_received,
          birth_certificate_received,
          vaccination_card_received,
          previous_school_record_received,
          health_notes,
          allergy_notes,
          medical_notes
        FROM students
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [studentId, dto.schoolId],
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        throw new NotFoundException('Student not found for this school.');
      }

      const nextFirstName =
        dto.firstName !== undefined
          ? dto.firstName.trim()
          : existing.first_name;

      const nextLastName =
        dto.lastName !== undefined ? dto.lastName.trim() : existing.last_name;

      if (!nextFirstName || !nextLastName) {
        throw new BadRequestException('First name and last name are required.');
      }

      const updatedResult = await client.query<{
        id: string;
        student_code: string | null;
        first_name: string | null;
        last_name: string | null;
        student_status: string;
      }>(
        `
        UPDATE students
        SET
          first_name = $3,
          last_name = $4,
          gender = $5,
          date_of_birth = $6::date,
          place_of_birth = $7,
          previous_school_name = $8,
          previous_school_address = $9,
          photo_received = $10,
          birth_certificate_received = $11,
          vaccination_card_received = $12,
          previous_school_record_received = $13,
          health_notes = $14,
          allergy_notes = $15,
          medical_notes = $16,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        RETURNING
          id,
          COALESCE(student_code, student_number) AS student_code,
          first_name,
          last_name,
          status::text AS student_status
        `,
        [
          studentId,
          dto.schoolId,
          nextFirstName,
          nextLastName,
          dto.gender !== undefined ? dto.gender || null : existing.gender,
          dto.dateOfBirth !== undefined
            ? dto.dateOfBirth || null
            : existing.date_of_birth,
          dto.placeOfBirth !== undefined
            ? dto.placeOfBirth.trim() || null
            : existing.place_of_birth,
          dto.previousSchoolName !== undefined
            ? dto.previousSchoolName.trim() || null
            : existing.previous_school_name,
          dto.previousSchoolAddress !== undefined
            ? dto.previousSchoolAddress.trim() || null
            : existing.previous_school_address,
          dto.photoReceived !== undefined
            ? dto.photoReceived
            : existing.photo_received,
          dto.birthCertificateReceived !== undefined
            ? dto.birthCertificateReceived
            : existing.birth_certificate_received,
          dto.vaccinationCardReceived !== undefined
            ? dto.vaccinationCardReceived
            : existing.vaccination_card_received,
          dto.previousSchoolRecordReceived !== undefined
            ? dto.previousSchoolRecordReceived
            : existing.previous_school_record_received,
          dto.healthNotes !== undefined
            ? dto.healthNotes.trim() || null
            : existing.health_notes,
          dto.allergyNotes !== undefined
            ? dto.allergyNotes.trim() || null
            : existing.allergy_notes,
          dto.medicalNotes !== undefined
            ? dto.medicalNotes.trim() || null
            : existing.medical_notes,
        ],
      );

      const updated = updatedResult.rows[0];

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_PROFILE_UPDATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Student profile updated for ${updated.first_name ?? ''} ${updated.last_name ?? ''}.`,
        payload: {
          studentId,
          studentCode: updated.student_code,
          studentStatus: updated.student_status,
        },
      });

      return {
        id: updated.id,
        studentCode: updated.student_code,
        firstName: updated.first_name,
        lastName: updated.last_name,
        studentStatus: updated.student_status,
      };
    });
  }
  async addStudentDocument(
    studentId: string,
    dto: CreateStudentDocumentDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessStudents(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const studentResult = await client.query(
        `
        SELECT id
        FROM students
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [studentId, dto.schoolId],
      );

      if (!studentResult.rows[0]) {
        throw new NotFoundException('Student not found for this school.');
      }

      const status = dto.documentStatus ?? 'PENDING';

      const result = await client.query<{
        id: string;
        document_type: string;
        document_status: string;
        file_name: string | null;
        file_url: string | null;
        received_at: string | null;
        verified_at: string | null;
        notes: string | null;
        created_at: string;
      }>(
        `
        INSERT INTO student_documents (
          school_id,
          student_id,
          document_type,
          document_status,
          file_name,
          file_url,
          received_at,
          verified_at,
          uploaded_by_user_id,
          verified_by_user_id,
          notes
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::date,
          CASE WHEN $4::text = 'VERIFIED' THEN NOW() ELSE NULL END,
          $8::uuid,
          CASE WHEN $4::text = 'VERIFIED' THEN $8::uuid ELSE NULL END,
          $9
        )
        RETURNING
          id,
          document_type,
          document_status,
          file_name,
          file_url,
          received_at::text AS received_at,
          verified_at::text AS verified_at,
          notes,
          created_at::text AS created_at
        `,
        [
          dto.schoolId,
          studentId,
          dto.documentType,
          status,
          dto.fileName?.trim() || null,
          dto.fileUrl?.trim() || null,
          dto.receivedAt ?? null,
          actorUserId,
          dto.notes?.trim() || null,
        ],
      );

      const document = result.rows[0];

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_DOCUMENT_ADDED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Document ${document.document_type} added to student file.`,
        payload: {
          studentId,
          documentId: document.id,
          documentType: document.document_type,
          documentStatus: document.document_status,
        },
      });

      return {
        id: document.id,
        documentType: document.document_type,
        documentStatus: document.document_status,
        fileName: document.file_name,
        fileUrl: document.file_url,
        receivedAt: document.received_at,
        verifiedAt: document.verified_at,
        notes: document.notes,
        createdAt: document.created_at,
      };
    });
  }

  async updateStudentDocument(
    studentId: string,
    documentId: string,
    dto: UpdateStudentDocumentDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessStudents(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const existingResult = await client.query<{
        id: string;
        document_type: string;
        document_status: string;
        file_name: string | null;
        file_url: string | null;
        received_at: string | null;
        notes: string | null;
      }>(
        `
        SELECT
          id,
          document_type,
          document_status,
          file_name,
          file_url,
          received_at::text AS received_at,
          notes
        FROM student_documents
        WHERE id = $1
          AND student_id = $2
          AND school_id = $3
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [documentId, studentId, dto.schoolId],
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        throw new NotFoundException('Student document not found.');
      }

      const nextStatus = dto.documentStatus ?? existing.document_status;

      const result = await client.query<{
        id: string;
        document_type: string;
        document_status: string;
        file_name: string | null;
        file_url: string | null;
        received_at: string | null;
        verified_at: string | null;
        notes: string | null;
        created_at: string;
      }>(
        `
        UPDATE student_documents
        SET
          document_type = $4,
          document_status = $5,
          file_name = $6,
          file_url = $7,
          received_at = $8::date,
          verified_at = CASE
            WHEN $5::text = 'VERIFIED' AND verified_at IS NULL THEN NOW()
            WHEN $5::text <> 'VERIFIED' THEN NULL
            ELSE verified_at
          END,
          verified_by_user_id = CASE
            WHEN $5::text = 'VERIFIED' THEN $9::uuid
            ELSE NULL
          END,
          notes = $10,
          updated_at = NOW()
        WHERE id = $1
          AND student_id = $2
          AND school_id = $3
          AND deleted_at IS NULL
        RETURNING
          id,
          document_type,
          document_status,
          file_name,
          file_url,
          received_at::text AS received_at,
          verified_at::text AS verified_at,
          notes,
          created_at::text AS created_at
        `,
        [
          documentId,
          studentId,
          dto.schoolId,
          dto.documentType ?? existing.document_type,
          nextStatus,
          dto.fileName !== undefined
            ? dto.fileName.trim() || null
            : existing.file_name,
          dto.fileUrl !== undefined
            ? dto.fileUrl.trim() || null
            : existing.file_url,
          dto.receivedAt !== undefined ? dto.receivedAt : existing.received_at,
          actorUserId,
          dto.notes !== undefined ? dto.notes.trim() || null : existing.notes,
        ],
      );

      const document = result.rows[0];

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_DOCUMENT_UPDATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Student document ${document.document_type} updated.`,
        payload: {
          studentId,
          documentId: document.id,
          documentType: document.document_type,
          documentStatus: document.document_status,
        },
      });

      return {
        id: document.id,
        documentType: document.document_type,
        documentStatus: document.document_status,
        fileName: document.file_name,
        fileUrl: document.file_url,
        receivedAt: document.received_at,
        verifiedAt: document.verified_at,
        notes: document.notes,
        createdAt: document.created_at,
      };
    });
  }
  async addStudentGuardian(
    studentId: string,
    dto: AddStudentGuardianDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessStudents(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    const fullName = dto.fullName.trim();

    if (!fullName) {
      throw new BadRequestException('Guardian full name is required.');
    }

    return this.db.withTransaction(async (client) => {
      const studentResult = await client.query(
        `
        SELECT id
        FROM students
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [studentId, dto.schoolId],
      );

      if (!studentResult.rows[0]) {
        throw new NotFoundException('Student not found for this school.');
      }

      if (dto.isPrimaryContact) {
        await client.query(
          `
          UPDATE student_guardians
          SET
            is_primary_contact = FALSE,
            is_primary = FALSE,
            updated_at = NOW()
          WHERE school_id = $1
            AND student_id = $2
            AND deleted_at IS NULL
          `,
          [dto.schoolId, studentId],
        );
      }

      const relationship = dto.relationship ?? 'TUTOR';

      const guardianResult = await client.query<{
        id: string;
        full_name: string;
        profession: string | null;
        phone_primary: string | null;
        phone_secondary: string | null;
        email: string | null;
        address: string | null;
      }>(
        `
        INSERT INTO guardians (
          school_id,
          full_name,
          profession,
          phone_primary,
          phone_secondary,
          email,
          address
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          full_name,
          profession,
          phone_primary,
          phone_secondary,
          email,
          address
        `,
        [
          dto.schoolId,
          fullName,
          dto.profession?.trim() || null,
          dto.phonePrimary?.trim() || null,
          dto.phoneSecondary?.trim() || null,
          dto.email?.trim() || null,
          dto.address?.trim() || null,
        ],
      );

      const guardian = guardianResult.rows[0];

      const relationResult = await client.query<{
        id: string;
        relationship: string;
        is_primary_contact: boolean;
        is_emergency_contact: boolean;
        is_authorized_pickup: boolean;
      }>(
        `
        INSERT INTO student_guardians (
          school_id,
          student_id,
          guardian_id,
          relationship,
          relationship_type,
          is_primary_contact,
          is_primary,
          is_emergency_contact,
          is_authorized_pickup,
          can_pick_up
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $8)
        RETURNING
          id,
          relationship,
          is_primary_contact,
          is_emergency_contact,
          is_authorized_pickup
        `,
        [
          dto.schoolId,
          studentId,
          guardian.id,
          relationship,
          relationship,
          dto.isPrimaryContact ?? false,
          dto.isEmergencyContact ?? false,
          dto.isAuthorizedPickup ?? false,
        ],
      );

      const relation = relationResult.rows[0];

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_GUARDIAN_ADDED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Guardian ${guardian.full_name} added to student file.`,
        payload: {
          studentId,
          guardianId: guardian.id,
          studentGuardianId: relation.id,
          relationship: relation.relationship,
        },
      });

      return {
        studentGuardianId: relation.id,
        guardianId: guardian.id,
        relationship: relation.relationship,
        isPrimaryContact: relation.is_primary_contact,
        isEmergencyContact: relation.is_emergency_contact,
        isAuthorizedPickup: relation.is_authorized_pickup,
        fullName: guardian.full_name,
        profession: guardian.profession,
        phonePrimary: guardian.phone_primary,
        phoneSecondary: guardian.phone_secondary,
        email: guardian.email,
        address: guardian.address,
      };
    });
  }

  async updateStudentGuardian(
    studentId: string,
    studentGuardianId: string,
    dto: UpdateStudentGuardianDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessStudents(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const existingResult = await client.query<{
        student_guardian_id: string;
        guardian_id: string;
        full_name: string;
        profession: string | null;
        phone_primary: string | null;
        phone_secondary: string | null;
        email: string | null;
        address: string | null;
        relationship: string;
        is_primary_contact: boolean;
        is_emergency_contact: boolean;
        is_authorized_pickup: boolean;
      }>(
        `
        SELECT
          sg.id AS student_guardian_id,
          g.id AS guardian_id,
          g.full_name,
          g.profession,
          g.phone_primary,
          g.phone_secondary,
          g.email,
          g.address,
          COALESCE(sg.relationship, sg.relationship_type) AS relationship,
          sg.is_primary_contact,
          sg.is_emergency_contact,
          sg.is_authorized_pickup
        FROM student_guardians sg
        JOIN guardians g ON g.id = sg.guardian_id
        WHERE sg.id = $1
          AND sg.student_id = $2
          AND sg.school_id = $3
          AND sg.deleted_at IS NULL
          AND g.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [studentGuardianId, studentId, dto.schoolId],
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        throw new NotFoundException('Guardian relationship not found.');
      }

      const nextFullName =
        dto.fullName !== undefined ? dto.fullName.trim() : existing.full_name;

      if (!nextFullName) {
        throw new BadRequestException('Guardian full name is required.');
      }

      const guardianResult = await client.query<{
        id: string;
        full_name: string;
        profession: string | null;
        phone_primary: string | null;
        phone_secondary: string | null;
        email: string | null;
        address: string | null;
      }>(
        `
        UPDATE guardians
        SET
          full_name = $2,
          profession = $3,
          phone_primary = $4,
          phone_secondary = $5,
          email = $6,
          address = $7,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $8
          AND deleted_at IS NULL
        RETURNING
          id,
          full_name,
          profession,
          phone_primary,
          phone_secondary,
          email,
          address
        `,
        [
          existing.guardian_id,
          nextFullName,
          dto.profession !== undefined
            ? dto.profession.trim() || null
            : existing.profession,
          dto.phonePrimary !== undefined
            ? dto.phonePrimary.trim() || null
            : existing.phone_primary,
          dto.phoneSecondary !== undefined
            ? dto.phoneSecondary.trim() || null
            : existing.phone_secondary,
          dto.email !== undefined ? dto.email.trim() || null : existing.email,
          dto.address !== undefined
            ? dto.address.trim() || null
            : existing.address,
          dto.schoolId,
        ],
      );

      const nextIsPrimaryContact =
        dto.isPrimaryContact !== undefined
          ? dto.isPrimaryContact
          : existing.is_primary_contact;

      if (nextIsPrimaryContact) {
        await client.query(
          `
          UPDATE student_guardians
          SET
            is_primary_contact = FALSE,
            is_primary = FALSE,
            updated_at = NOW()
          WHERE school_id = $1
            AND student_id = $2
            AND id <> $3
            AND deleted_at IS NULL
          `,
          [dto.schoolId, studentId, studentGuardianId],
        );
      }

      const relationResult = await client.query<{
        id: string;
        relationship: string;
        is_primary_contact: boolean;
        is_emergency_contact: boolean;
        is_authorized_pickup: boolean;
      }>(
        `
        UPDATE student_guardians
        SET
          relationship = $3,
          relationship_type = $4,
          is_primary_contact = $5,
          is_primary = $5,
          is_emergency_contact = $6,
          is_authorized_pickup = $7,
          can_pick_up = $7,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        RETURNING
          id,
          relationship,
          is_primary_contact,
          is_emergency_contact,
          is_authorized_pickup
        `,
        [
          studentGuardianId,
          dto.schoolId,
          dto.relationship ?? existing.relationship,
          dto.relationship ?? existing.relationship,
          nextIsPrimaryContact,
          dto.isEmergencyContact !== undefined
            ? dto.isEmergencyContact
            : existing.is_emergency_contact,
          dto.isAuthorizedPickup !== undefined
            ? dto.isAuthorizedPickup
            : existing.is_authorized_pickup,
        ],
      );

      const guardian = guardianResult.rows[0];
      const relation = relationResult.rows[0];

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_GUARDIAN_UPDATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Guardian ${guardian.full_name} updated.`,
        payload: {
          studentId,
          guardianId: guardian.id,
          studentGuardianId: relation.id,
          relationship: relation.relationship,
        },
      });

      return {
        studentGuardianId: relation.id,
        guardianId: guardian.id,
        relationship: relation.relationship,
        isPrimaryContact: relation.is_primary_contact,
        isEmergencyContact: relation.is_emergency_contact,
        isAuthorizedPickup: relation.is_authorized_pickup,
        fullName: guardian.full_name,
        profession: guardian.profession,
        phonePrimary: guardian.phone_primary,
        phoneSecondary: guardian.phone_secondary,
        email: guardian.email,
        address: guardian.address,
      };
    });
  }
  async createStudent(
    dto: CreateSchoolStudentDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessStudents(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    if (!firstName || !lastName) {
      throw new BadRequestException('First name and last name are required.');
    }

    return this.db.withTransaction(async (client) => {
      let section:
        | {
            id: string;
            academic_year_id: string;
            grade_level_id: string;
            start_date: string;
          }
        | undefined;

      if (dto.sectionId) {
        const sectionResult = await client.query<{
          id: string;
          academic_year_id: string;
          grade_level_id: string;
          start_date: string;
        }>(
          `
          SELECT
            se.id,
            se.academic_year_id,
            se.grade_level_id,
            GREATEST(ay.start_date, CURRENT_DATE)::text AS start_date
          FROM sections se
          JOIN academic_years ay
            ON ay.id = se.academic_year_id
           AND ay.deleted_at IS NULL
          WHERE se.id = $1
            AND se.school_id = $2
            AND se.deleted_at IS NULL
          LIMIT 1
          `,
          [dto.sectionId, dto.schoolId],
        );

        section = sectionResult.rows[0];

        if (!section) {
          throw new NotFoundException('Section not found for this school.');
        }
      }

      const studentResult = await client.query<{
        id: string;
        student_code: string | null;
        first_name: string | null;
        last_name: string | null;
      }>(
        `
        WITH resolved_code AS (
          SELECT COALESCE(NULLIF(UPPER(BTRIM($2::text)), ''), next_student_code($1)) AS value
        )
        INSERT INTO students (
          school_id,
          student_number,
          student_code,
          first_name,
          last_name,
          gender,
          date_of_birth,
          place_of_birth,
          photo_url,
          previous_school_name,
          previous_school_address,
          photo_received,
          birth_certificate_received,
          vaccination_card_received,
          previous_school_record_received,
          vaccination_status,
          allergies,
          medical_notes,
          special_needs
        )
        SELECT
          $1,
          value,
          value,
          $3,
          $4,
          $5,
          $6::date,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18
        FROM resolved_code
        RETURNING
          id,
          student_code,
          first_name,
          last_name
        `,
        [
          dto.schoolId,
          dto.studentCode ?? null,
          firstName,
          lastName,
          dto.gender ?? null,
          dto.dateOfBirth ?? null,
          dto.placeOfBirth?.trim() || null,
          dto.photoUrl?.trim() || null,
          dto.previousSchoolName?.trim() || null,
          dto.previousSchoolAddress?.trim() || null,
          dto.photoReceived ?? false,
          dto.birthCertificateReceived ?? false,
          dto.vaccinationCardReceived ?? false,
          dto.previousSchoolRecordReceived ?? false,
          dto.vaccinationStatus?.trim() || null,
          dto.allergies?.trim() || null,
          dto.medicalNotes?.trim() || null,
          dto.specialNeeds?.trim() || null,
        ],
      );

      const student = studentResult.rows[0];

      if (section) {
        await client.query(
          `
          INSERT INTO enrollments (
            student_id,
            academic_year_id,
            grade_level_id,
            section_id,
            enrollment_status,
            start_date
          )
          VALUES ($1, $2, $3, $4, 'ACTIVE', $5::date)
          `,
          [
            student.id,
            section.academic_year_id,
            section.grade_level_id,
            section.id,
            section.start_date,
          ],
        );
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_CREATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary:
          `Student ${student.first_name ?? ''} ${student.last_name ?? ''} created.`.trim(),
        payload: {
          studentId: student.id,
          studentCode: student.student_code,
          sectionId: section?.id ?? null,
        },
      });

      return {
        id: student.id,
        studentCode: student.student_code,
        firstName: student.first_name,
        lastName: student.last_name,
        sectionId: section?.id ?? null,
      };
    });
  }
}
