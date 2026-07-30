import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { ChangeAdmissionStatusDto } from './dto/change-admission-status.dto';
import { ConvertAdmissionToStudentDto } from './dto/convert-admission-to-student.dto';
import { CreateAdmissionApplicationDto } from './dto/create-admission-application.dto';
import { ListAdmissionApplicationsDto } from './dto/list-admission-applications.dto';
import { UpdateAdmissionApplicationDto } from './dto/update-admission-application.dto';
import { UpdateAdmissionExamDto } from './dto/update-admission-exam.dto';
import { UpdateAdmissionRegistrationFeeDto } from './dto/update-admission-registration-fee.dto';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  async assertUserCanAccessAdmissions(
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
        'You do not have permission to access admissions.',
      );
    }
  }

  async listApplications(
    query: ListAdmissionApplicationsDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAdmissions(
      actorUserId,
      query.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'FINANCE_ADMIN', 'TEACHER'],
    );

    const search = query.search?.trim().toLowerCase() ?? '';

    const result = await this.db.query<{
      id: string;
      application_number: string;
      admission_status: string;
      first_name: string;
      last_name: string;
      gender: string | null;
      date_of_birth: string | null;
      parent_full_name: string | null;
      parent_phone: string | null;
      desired_grade_level_code: string | null;
      desired_grade_level_name_i18n: Record<string, string> | null;
      desired_section_code: string | null;
      desired_section_name_i18n: Record<string, string> | null;
      created_at: string;
    }>(
      `
      SELECT
        app.id,
        app.application_number,
        app.admission_status,
        app.first_name,
        app.last_name,
        app.gender,
        app.date_of_birth::text AS date_of_birth,
        app.parent_full_name,
        app.parent_phone,
        gl.code AS desired_grade_level_code,
        gl.name_i18n AS desired_grade_level_name_i18n,
        se.code AS desired_section_code,
        se.name_i18n AS desired_section_name_i18n,
        app.created_at::text AS created_at
      FROM admission_applications app
      LEFT JOIN grade_levels gl
        ON gl.id = app.desired_grade_level_id
       AND gl.deleted_at IS NULL
      LEFT JOIN sections se
        ON se.id = app.desired_section_id
       AND se.deleted_at IS NULL
      WHERE app.school_id = $1
        AND app.deleted_at IS NULL
        AND ($3::text IS NULL OR app.admission_status = $3::text)
        AND (
          $2 = ''
          OR LOWER(app.first_name) LIKE '%' || $2 || '%'
          OR LOWER(app.last_name) LIKE '%' || $2 || '%'
          OR LOWER(app.application_number) LIKE '%' || $2 || '%'
          OR LOWER(COALESCE(app.parent_full_name, '')) LIKE '%' || $2 || '%'
          OR LOWER(COALESCE(app.parent_phone, '')) LIKE '%' || $2 || '%'
          OR LOWER(CONCAT(app.first_name, ' ', app.last_name)) LIKE '%' || $2 || '%'
        )
      ORDER BY app.created_at DESC
      LIMIT 200
      `,
      [query.schoolId, search, query.status ?? null],
    );

    return result.rows.map((row) => ({
      id: row.id,
      applicationNumber: row.application_number,
      admissionStatus: row.admission_status,
      firstName: row.first_name,
      lastName: row.last_name,
      gender: row.gender,
      dateOfBirth: row.date_of_birth,
      parentFullName: row.parent_full_name,
      parentPhone: row.parent_phone,
      desiredGradeLevelCode: row.desired_grade_level_code,
      desiredGradeLevelNameI18n: row.desired_grade_level_name_i18n,
      desiredSectionCode: row.desired_section_code,
      desiredSectionNameI18n: row.desired_section_name_i18n,
      createdAt: row.created_at,
    }));
  }

  async getAdmissionsSummary(
    query: { schoolId: string },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAdmissions(
      actorUserId,
      query.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'FINANCE_ADMIN', 'TEACHER'],
    );

    const summaryResult = await this.db.query<{
      total_applications: string;
      open_applications: string;
      pending_documents: string;
      pending_payment: string;
      exam_scheduled: string;
      admitted: string;
      converted_to_student: string;
      rejected_or_cancelled: string;
    }>(
      `
      SELECT
        COUNT(*)::text AS total_applications,

        COUNT(*) FILTER (
          WHERE admission_status NOT IN (
            'CONVERTED_TO_STUDENT',
            'REJECTED',
            'CANCELLED'
          )
        )::text AS open_applications,

        COUNT(*) FILTER (
          WHERE admission_status = 'DOCUMENTS_INCOMPLETE'
             OR photo_received = FALSE
             OR birth_certificate_received = FALSE
             OR vaccination_card_received = FALSE
             OR previous_school_record_received = FALSE
        )::text AS pending_documents,

        COUNT(*) FILTER (
          WHERE registration_fee_required = TRUE
            AND registration_fee_status = 'PENDING'
        )::text AS pending_payment,

        COUNT(*) FILTER (
          WHERE admission_status = 'EXAM_SCHEDULED'
        )::text AS exam_scheduled,

        COUNT(*) FILTER (
          WHERE admission_status IN (
            'ADMITTED',
            'CONDITIONALLY_ADMITTED',
            'CONFIRMED'
          )
        )::text AS admitted,

        COUNT(*) FILTER (
          WHERE admission_status = 'CONVERTED_TO_STUDENT'
        )::text AS converted_to_student,

        COUNT(*) FILTER (
          WHERE admission_status IN ('REJECTED', 'CANCELLED')
        )::text AS rejected_or_cancelled

      FROM admission_applications
      WHERE school_id = $1
        AND deleted_at IS NULL
      `,
      [query.schoolId],
    );

    const statusResult = await this.db.query<{
      admission_status: string;
      count: string;
    }>(
      `
      SELECT
        admission_status,
        COUNT(*)::text AS count
      FROM admission_applications
      WHERE school_id = $1
        AND deleted_at IS NULL
      GROUP BY admission_status
      ORDER BY admission_status ASC
      `,
      [query.schoolId],
    );

    const upcomingExamsResult = await this.db.query<{
      id: string;
      admission_application_id: string;
      application_number: string;
      first_name: string;
      last_name: string;
      scheduled_at: string | null;
      location: string | null;
      supervisor_name: string | null;
    }>(
      `
      SELECT
        exam.id,
        app.id AS admission_application_id,
        app.application_number,
        app.first_name,
        app.last_name,
        exam.scheduled_at::text AS scheduled_at,
        exam.location,
        exam.supervisor_name
      FROM admission_exam_records exam
      JOIN admission_applications app
        ON app.id = exam.admission_application_id
       AND app.deleted_at IS NULL
      WHERE exam.school_id = $1
        AND exam.deleted_at IS NULL
        AND exam.exam_status = 'SCHEDULED'
        AND exam.scheduled_at IS NOT NULL
      ORDER BY exam.scheduled_at ASC
      LIMIT 5
      `,
      [query.schoolId],
    );

    const summary = summaryResult.rows[0];

    return {
      totalApplications: Number(summary.total_applications),
      openApplications: Number(summary.open_applications),
      pendingDocuments: Number(summary.pending_documents),
      pendingPayment: Number(summary.pending_payment),
      examScheduled: Number(summary.exam_scheduled),
      admitted: Number(summary.admitted),
      convertedToStudent: Number(summary.converted_to_student),
      rejectedOrCancelled: Number(summary.rejected_or_cancelled),
      byStatus: statusResult.rows.map((row) => ({
        status: row.admission_status,
        count: Number(row.count),
      })),
      upcomingExams: upcomingExamsResult.rows.map((row) => ({
        id: row.id,
        admissionApplicationId: row.admission_application_id,
        applicationNumber: row.application_number,
        firstName: row.first_name,
        lastName: row.last_name,
        scheduledAt: row.scheduled_at,
        location: row.location,
        supervisorName: row.supervisor_name,
      })),
    };
  }
  async createApplication(
    dto: CreateAdmissionApplicationDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAdmissions(
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
      if (dto.academicYearId) {
        const academicYearResult = await client.query(
          `
          SELECT id
          FROM academic_years
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          LIMIT 1
          `,
          [dto.academicYearId, dto.schoolId],
        );

        if (!academicYearResult.rows[0]) {
          throw new NotFoundException(
            'Academic year not found for this school.',
          );
        }
      }

      if (dto.desiredGradeLevelId) {
        const gradeLevelResult = await client.query(
          `
          SELECT id
          FROM grade_levels
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          LIMIT 1
          `,
          [dto.desiredGradeLevelId, dto.schoolId],
        );

        if (!gradeLevelResult.rows[0]) {
          throw new NotFoundException('Grade level not found for this school.');
        }
      }

      if (dto.desiredSectionId) {
        const sectionResult = await client.query(
          `
          SELECT id
          FROM sections
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          LIMIT 1
          `,
          [dto.desiredSectionId, dto.schoolId],
        );

        if (!sectionResult.rows[0]) {
          throw new NotFoundException('Section not found for this school.');
        }
      }

      const numberResult = await client.query<{
        application_number: string;
      }>(
        `
        SELECT next_admission_application_number($1) AS application_number
        `,
        [dto.schoolId],
      );

      const applicationNumber = numberResult.rows[0].application_number;

      const result = await client.query<{
        id: string;
        application_number: string;
        admission_status: string;
        first_name: string;
        last_name: string;
      }>(
        `
        INSERT INTO admission_applications (
          school_id,
          application_number,
          academic_year_id,
          desired_grade_level_id,
          desired_section_id,
          admission_status,
          first_name,
          last_name,
          gender,
          date_of_birth,
          place_of_birth,
          previous_school_name,
          previous_school_address,
          parent_full_name,
          parent_phone,
          parent_email,
          parent_profession,
          parent_address,
          emergency_contact_name,
          emergency_contact_phone,
          photo_received,
          birth_certificate_received,
          vaccination_card_received,
          previous_school_record_received,
          parent_id_document_received,
          conduct_certificate_received,
          notes,
          created_by_user_id
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10::date,
          $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20,
          $21, $22, $23, $24, $25, $26,
          $27, $28
        )
        RETURNING
          id,
          application_number,
          admission_status,
          first_name,
          last_name
        `,
        [
          dto.schoolId,
          applicationNumber,
          dto.academicYearId ?? null,
          dto.desiredGradeLevelId ?? null,
          dto.desiredSectionId ?? null,
          dto.admissionStatus ?? 'APPLICATION_SUBMITTED',
          firstName,
          lastName,
          dto.gender ?? null,
          dto.dateOfBirth ?? null,
          dto.placeOfBirth?.trim() || null,
          dto.previousSchoolName?.trim() || null,
          dto.previousSchoolAddress?.trim() || null,
          dto.parentFullName?.trim() || null,
          dto.parentPhone?.trim() || null,
          dto.parentEmail?.trim() || null,
          dto.parentProfession?.trim() || null,
          dto.parentAddress?.trim() || null,
          dto.emergencyContactName?.trim() || null,
          dto.emergencyContactPhone?.trim() || null,
          dto.photoReceived ?? false,
          dto.birthCertificateReceived ?? false,
          dto.vaccinationCardReceived ?? false,
          dto.previousSchoolRecordReceived ?? false,
          dto.parentIdDocumentReceived ?? false,
          dto.conductCertificateReceived ?? false,
          dto.notes?.trim() || null,
          actorUserId,
        ],
      );

      const application = result.rows[0];

      await client.query(
        `
        INSERT INTO admission_status_history (
          school_id,
          admission_application_id,
          previous_status,
          new_status,
          reason,
          changed_by_user_id
        )
        VALUES ($1, $2, NULL, $3, $4, $5)
        `,
        [
          dto.schoolId,
          application.id,
          application.admission_status,
          'Application created.',
          actorUserId,
        ],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'ADMISSION_APPLICATION_CREATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Admission application ${application.application_number} created for ${application.first_name} ${application.last_name}.`,
        payload: {
          admissionApplicationId: application.id,
          applicationNumber: application.application_number,
          admissionStatus: application.admission_status,
        },
      });

      return {
        id: application.id,
        applicationNumber: application.application_number,
        admissionStatus: application.admission_status,
        firstName: application.first_name,
        lastName: application.last_name,
      };
    });
  }
  async getApplicationDetails(
    input: {
      schoolId: string;
      admissionApplicationId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAdmissions(
      actorUserId,
      input.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'FINANCE_ADMIN', 'TEACHER'],
    );

    const result = await this.db.query<{
      id: string;
      school_id: string;
      school_name: string;
      school_code: string | null;
      application_number: string;
      academic_year_id: string | null;
      academic_year_name_i18n: Record<string, string> | null;
      desired_grade_level_id: string | null;
      desired_grade_level_code: string | null;
      desired_grade_level_name_i18n: Record<string, string> | null;
      desired_section_id: string | null;
      desired_section_code: string | null;
      desired_section_name_i18n: Record<string, string> | null;
      admission_status: string;
      first_name: string;
      last_name: string;
      gender: string | null;
      date_of_birth: string | null;
      place_of_birth: string | null;
      previous_school_name: string | null;
      previous_school_address: string | null;
      parent_full_name: string | null;
      parent_phone: string | null;
      parent_email: string | null;
      parent_profession: string | null;
      parent_address: string | null;
      emergency_contact_name: string | null;
      emergency_contact_phone: string | null;
      photo_received: boolean;
      birth_certificate_received: boolean;
      vaccination_card_received: boolean;
      previous_school_record_received: boolean;
      parent_id_document_received: boolean;
      conduct_certificate_received: boolean;
      notes: string | null;
      registration_fee_required: boolean;
      registration_fee_amount: string;
      registration_fee_currency_code: string;
      registration_fee_status: string;
      registration_payment_method: string | null;
      registration_payment_reference: string | null;
      registration_fee_paid_at: string | null;
      registration_fee_receipt_number: string | null;
      registration_payment_notes: string | null;
      converted_student_id: string | null;
      converted_student_code: string | null;
      converted_student_first_name: string | null;
      converted_student_last_name: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        app.id,
        app.school_id,
        sc.name AS school_name,
        sc.code AS school_code,
        app.application_number,

        app.academic_year_id,
        ay.name_i18n AS academic_year_name_i18n,

        app.desired_grade_level_id,
        gl.code AS desired_grade_level_code,
        gl.name_i18n AS desired_grade_level_name_i18n,

        app.desired_section_id,
        se.code AS desired_section_code,
        se.name_i18n AS desired_section_name_i18n,

        app.admission_status,
        app.first_name,
        app.last_name,
        app.gender,
        app.date_of_birth::text AS date_of_birth,
        app.place_of_birth,
        app.previous_school_name,
        app.previous_school_address,

        app.parent_full_name,
        app.parent_phone,
        app.parent_email,
        app.parent_profession,
        app.parent_address,

        app.emergency_contact_name,
        app.emergency_contact_phone,

        app.photo_received,
        app.birth_certificate_received,
        app.vaccination_card_received,
        app.previous_school_record_received,
        app.parent_id_document_received,
        app.conduct_certificate_received,

        app.notes,

        app.registration_fee_required,

        app.registration_fee_amount::text AS registration_fee_amount,

        app.registration_fee_currency_code,

        app.registration_fee_status,

        app.registration_payment_method,

        app.registration_payment_reference,

        app.registration_fee_paid_at::text AS registration_fee_paid_at,

        app.registration_fee_receipt_number,

        app.registration_payment_notes,
        app.converted_student_id,

        st.student_code AS converted_student_code,
        st.first_name AS converted_student_first_name,
        st.last_name AS converted_student_last_name,

        app.created_at::text AS created_at,
        app.updated_at::text AS updated_at

      FROM admission_applications app
      JOIN schools sc
        ON sc.id = app.school_id
       AND sc.deleted_at IS NULL
      LEFT JOIN academic_years ay
        ON ay.id = app.academic_year_id
       AND ay.deleted_at IS NULL
      LEFT JOIN grade_levels gl
        ON gl.id = app.desired_grade_level_id
       AND gl.deleted_at IS NULL
      LEFT JOIN sections se
        ON se.id = app.desired_section_id
       AND se.deleted_at IS NULL
      LEFT JOIN students st
        ON st.id = app.converted_student_id
       AND st.deleted_at IS NULL
      WHERE app.id = $1
        AND app.school_id = $2
        AND app.deleted_at IS NULL
      LIMIT 1
      `,
      [input.admissionApplicationId, input.schoolId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException('Admission application not found.');
    }

    const historyResult = await this.db.query<{
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
      FROM admission_status_history
      WHERE school_id = $1
        AND admission_application_id = $2
        AND deleted_at IS NULL
      ORDER BY changed_at DESC
      LIMIT 50
      `,
      [input.schoolId, input.admissionApplicationId],
    );

    const examResult = await this.db.query<{
      id: string;
      exam_status: string;
      scheduled_at: string | null;
      location: string | null;
      supervisor_name: string | null;
      french_score: string | null;
      math_score: string | null;
      english_score: string | null;
      general_score: string | null;
      interview_score: string | null;
      total_score: string | null;
      max_score: string;
      decision_status: string | null;
      notes: string | null;
      updated_at: string;
    }>(
      `
      SELECT
        id,
        exam_status,
        scheduled_at::text AS scheduled_at,
        location,
        supervisor_name,
        french_score::text AS french_score,
        math_score::text AS math_score,
        english_score::text AS english_score,
        general_score::text AS general_score,
        interview_score::text AS interview_score,
        total_score::text AS total_score,
        max_score::text AS max_score,
        decision_status,
        notes,
        updated_at::text AS updated_at
      FROM admission_exam_records
      WHERE school_id = $1
        AND admission_application_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.schoolId, input.admissionApplicationId],
    );
    return {
      id: row.id,
      schoolId: row.school_id,
      school: {
        name: row.school_name,
        code: row.school_code,
      },
      applicationNumber: row.application_number,
      admissionStatus: row.admission_status,

      academicYear: row.academic_year_id
        ? {
            id: row.academic_year_id,
            nameI18n: row.academic_year_name_i18n,
          }
        : null,

      desiredGradeLevel: row.desired_grade_level_id
        ? {
            id: row.desired_grade_level_id,
            code: row.desired_grade_level_code,
            nameI18n: row.desired_grade_level_name_i18n,
          }
        : null,

      desiredSection: row.desired_section_id
        ? {
            id: row.desired_section_id,
            code: row.desired_section_code,
            nameI18n: row.desired_section_name_i18n,
          }
        : null,

      candidate: {
        firstName: row.first_name,
        lastName: row.last_name,
        gender: row.gender,
        dateOfBirth: row.date_of_birth,
        placeOfBirth: row.place_of_birth,
        previousSchoolName: row.previous_school_name,
        previousSchoolAddress: row.previous_school_address,
      },

      parent: {
        fullName: row.parent_full_name,
        phone: row.parent_phone,
        email: row.parent_email,
        profession: row.parent_profession,
        address: row.parent_address,
      },

      emergencyContact: {
        name: row.emergency_contact_name,
        phone: row.emergency_contact_phone,
      },

      documents: {
        photoReceived: row.photo_received,
        birthCertificateReceived: row.birth_certificate_received,
        vaccinationCardReceived: row.vaccination_card_received,
        previousSchoolRecordReceived: row.previous_school_record_received,
        parentIdDocumentReceived: row.parent_id_document_received,
        conductCertificateReceived: row.conduct_certificate_received,
      },

      notes: row.notes,

      registrationFee: {
        required: row.registration_fee_required,

        amount: Number(row.registration_fee_amount),

        currencyCode: row.registration_fee_currency_code,

        status: row.registration_fee_status,

        paymentMethod: row.registration_payment_method,

        paymentReference: row.registration_payment_reference,

        paidAt: row.registration_fee_paid_at,

        receiptNumber: row.registration_fee_receipt_number,

        notes: row.registration_payment_notes,
      },

      convertedStudent: row.converted_student_id
        ? {
            id: row.converted_student_id,
            studentCode: row.converted_student_code,
            firstName: row.converted_student_first_name,
            lastName: row.converted_student_last_name,
          }
        : null,

      exam: examResult.rows[0]
        ? {
            id: examResult.rows[0].id,
            examStatus: examResult.rows[0].exam_status,
            scheduledAt: examResult.rows[0].scheduled_at,
            location: examResult.rows[0].location,
            supervisorName: examResult.rows[0].supervisor_name,
            frenchScore:
              examResult.rows[0].french_score === null
                ? null
                : Number(examResult.rows[0].french_score),
            mathScore:
              examResult.rows[0].math_score === null
                ? null
                : Number(examResult.rows[0].math_score),
            englishScore:
              examResult.rows[0].english_score === null
                ? null
                : Number(examResult.rows[0].english_score),
            generalScore:
              examResult.rows[0].general_score === null
                ? null
                : Number(examResult.rows[0].general_score),
            interviewScore:
              examResult.rows[0].interview_score === null
                ? null
                : Number(examResult.rows[0].interview_score),
            totalScore:
              examResult.rows[0].total_score === null
                ? null
                : Number(examResult.rows[0].total_score),
            maxScore: Number(examResult.rows[0].max_score),
            decisionStatus: examResult.rows[0].decision_status,
            notes: examResult.rows[0].notes,
            updatedAt: examResult.rows[0].updated_at,
          }
        : null,
      statusHistory: historyResult.rows.map((item) => ({
        id: item.id,
        previousStatus: item.previous_status,
        newStatus: item.new_status,
        reason: item.reason,
        changedByUserId: item.changed_by_user_id,
        changedAt: item.changed_at,
      })),

      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async changeApplicationStatus(
    admissionApplicationId: string,
    dto: ChangeAdmissionStatusDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAdmissions(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const existingResult = await client.query<{
        id: string;
        application_number: string;
        admission_status: string;
        first_name: string;
        last_name: string;
        converted_student_id: string | null;
      }>(
        `
        SELECT
          id,
          application_number,
          admission_status,
          first_name,
          last_name,
          converted_student_id
        FROM admission_applications
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [admissionApplicationId, dto.schoolId],
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        throw new NotFoundException('Admission application not found.');
      }

      if (
        existing.converted_student_id &&
        dto.newStatus !== 'CONVERTED_TO_STUDENT'
      ) {
        throw new BadRequestException(
          'This admission application is already converted to a student file.',
        );
      }

      if (existing.admission_status === dto.newStatus) {
        return {
          id: existing.id,
          applicationNumber: existing.application_number,
          admissionStatus: existing.admission_status,
          unchanged: true,
        };
      }

      const updatedResult = await client.query<{
        id: string;
        application_number: string;
        admission_status: string;
      }>(
        `
        UPDATE admission_applications
        SET
          admission_status = $3,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        RETURNING
          id,
          application_number,
          admission_status
        `,
        [admissionApplicationId, dto.schoolId, dto.newStatus],
      );

      const updated = updatedResult.rows[0];

      await client.query(
        `
        INSERT INTO admission_status_history (
          school_id,
          admission_application_id,
          previous_status,
          new_status,
          reason,
          changed_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          dto.schoolId,
          admissionApplicationId,
          existing.admission_status,
          dto.newStatus,
          dto.reason?.trim() || null,
          actorUserId,
        ],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'ADMISSION_STATUS_CHANGED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Admission ${existing.application_number} status changed from ${existing.admission_status} to ${dto.newStatus}.`,
        payload: {
          admissionApplicationId,
          applicationNumber: existing.application_number,
          previousStatus: existing.admission_status,
          newStatus: dto.newStatus,
          reason: dto.reason?.trim() || null,
        },
      });

      return {
        id: updated.id,
        applicationNumber: updated.application_number,
        admissionStatus: updated.admission_status,
        previousStatus: existing.admission_status,
        reason: dto.reason?.trim() || null,
      };
    });
  }
  async updateAdmissionExam(
    admissionApplicationId: string,
    dto: UpdateAdmissionExamDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAdmissions(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    return this.db.withTransaction(async (client) => {
      const applicationResult = await client.query<{
        id: string;
        application_number: string;
        admission_status: string;
        converted_student_id: string | null;
      }>(
        `
        SELECT
          id,
          application_number,
          admission_status,
          converted_student_id
        FROM admission_applications
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [admissionApplicationId, dto.schoolId],
      );

      const application = applicationResult.rows[0];

      if (!application) {
        throw new NotFoundException('Admission application not found.');
      }

      if (application.converted_student_id) {
        throw new BadRequestException(
          'This admission application has already been converted to a student file.',
        );
      }

      const examStatus = dto.examStatus ?? 'SCHEDULED';
      const syncAdmissionStatus = dto.syncAdmissionStatus ?? true;

      const examResult = await client.query<{
        id: string;
        exam_status: string;
        scheduled_at: string | null;
        location: string | null;
        supervisor_name: string | null;
        french_score: string | null;
        math_score: string | null;
        english_score: string | null;
        general_score: string | null;
        interview_score: string | null;
        total_score: string | null;
        max_score: string;
        decision_status: string | null;
        notes: string | null;
      }>(
        `
        INSERT INTO admission_exam_records (
          school_id,
          admission_application_id,
          exam_status,
          scheduled_at,
          location,
          supervisor_name,
          french_score,
          math_score,
          english_score,
          general_score,
          interview_score,
          total_score,
          max_score,
          decision_status,
          notes,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (
          $1, $2, $3, $4::timestamptz, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $16
        )
        ON CONFLICT (admission_application_id)
        WHERE deleted_at IS NULL
        DO UPDATE SET
          exam_status = EXCLUDED.exam_status,
          scheduled_at = EXCLUDED.scheduled_at,
          location = EXCLUDED.location,
          supervisor_name = EXCLUDED.supervisor_name,
          french_score = EXCLUDED.french_score,
          math_score = EXCLUDED.math_score,
          english_score = EXCLUDED.english_score,
          general_score = EXCLUDED.general_score,
          interview_score = EXCLUDED.interview_score,
          total_score = EXCLUDED.total_score,
          max_score = EXCLUDED.max_score,
          decision_status = EXCLUDED.decision_status,
          notes = EXCLUDED.notes,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
        RETURNING
          id,
          exam_status,
          scheduled_at::text AS scheduled_at,
          location,
          supervisor_name,
          french_score::text AS french_score,
          math_score::text AS math_score,
          english_score::text AS english_score,
          general_score::text AS general_score,
          interview_score::text AS interview_score,
          total_score::text AS total_score,
          max_score::text AS max_score,
          decision_status,
          notes
        `,
        [
          dto.schoolId,
          admissionApplicationId,
          examStatus,
          dto.scheduledAt || null,
          dto.location?.trim() || null,
          dto.supervisorName?.trim() || null,
          dto.frenchScore ?? null,
          dto.mathScore ?? null,
          dto.englishScore ?? null,
          dto.generalScore ?? null,
          dto.interviewScore ?? null,
          dto.totalScore ?? null,
          dto.maxScore ?? 100,
          dto.decisionStatus ?? null,
          dto.notes?.trim() || null,
          actorUserId,
        ],
      );

      const exam = examResult.rows[0];

      let nextAdmissionStatus: string | null = null;

      if (syncAdmissionStatus) {
        if (exam.exam_status === 'SCHEDULED') {
          nextAdmissionStatus = 'EXAM_SCHEDULED';
        }

        if (exam.exam_status === 'COMPLETED' && exam.decision_status) {
          if (
            [
              'ADMITTED',
              'CONDITIONALLY_ADMITTED',
              'WAITLISTED',
              'REJECTED',
            ].includes(exam.decision_status)
          ) {
            nextAdmissionStatus = exam.decision_status;
          }
        }
      }

      if (
        nextAdmissionStatus &&
        nextAdmissionStatus !== application.admission_status
      ) {
        await client.query(
          `
          UPDATE admission_applications
          SET
            admission_status = $3,
            updated_at = NOW()
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          `,
          [admissionApplicationId, dto.schoolId, nextAdmissionStatus],
        );

        await client.query(
          `
          INSERT INTO admission_status_history (
            school_id,
            admission_application_id,
            previous_status,
            new_status,
            reason,
            changed_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            dto.schoolId,
            admissionApplicationId,
            application.admission_status,
            nextAdmissionStatus,
            'Admission status updated from exam workflow.',
            actorUserId,
          ],
        );
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'ADMISSION_EXAM_UPDATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Admission exam updated for ${application.application_number}.`,
        payload: {
          admissionApplicationId,
          applicationNumber: application.application_number,
          examStatus: exam.exam_status,
          decisionStatus: exam.decision_status,
          syncedAdmissionStatus: nextAdmissionStatus,
        },
      });

      return {
        id: exam.id,
        examStatus: exam.exam_status,
        scheduledAt: exam.scheduled_at,
        location: exam.location,
        supervisorName: exam.supervisor_name,
        frenchScore:
          exam.french_score === null ? null : Number(exam.french_score),
        mathScore: exam.math_score === null ? null : Number(exam.math_score),
        englishScore:
          exam.english_score === null ? null : Number(exam.english_score),
        generalScore:
          exam.general_score === null ? null : Number(exam.general_score),
        interviewScore:
          exam.interview_score === null ? null : Number(exam.interview_score),
        totalScore: exam.total_score === null ? null : Number(exam.total_score),
        maxScore: Number(exam.max_score),
        decisionStatus: exam.decision_status,
        notes: exam.notes,
        syncedAdmissionStatus: nextAdmissionStatus,
      };
    });
  }
  async updateRegistrationFee(
    admissionApplicationId: string,
    dto: UpdateAdmissionRegistrationFeeDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAdmissions(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'FINANCE_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const existingResult = await client.query<{
        id: string;
        application_number: string;
        converted_student_id: string | null;
        registration_fee_required: boolean;
        registration_fee_amount: string;
        registration_fee_currency_code: string;
        registration_fee_status: string;
        registration_fee_receipt_number: string | null;
      }>(
        `
        SELECT
          id,
          application_number,
          converted_student_id,
          registration_fee_required,
          registration_fee_amount::text AS registration_fee_amount,
          registration_fee_currency_code,
          registration_fee_status,
          registration_fee_receipt_number
        FROM admission_applications
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [admissionApplicationId, dto.schoolId],
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        throw new NotFoundException('Admission application not found.');
      }

      if (existing.converted_student_id) {
        throw new BadRequestException(
          'This admission application has already been converted to a student file.',
        );
      }

      const nextRequired =
        dto.registrationFeeRequired !== undefined
          ? dto.registrationFeeRequired
          : existing.registration_fee_required;

      const nextStatus =
        dto.registrationFeeStatus ??
        (nextRequired ? existing.registration_fee_status : 'NOT_REQUIRED');

      const nextAmount =
        dto.registrationFeeAmount !== undefined
          ? dto.registrationFeeAmount
          : Number(existing.registration_fee_amount);

      const nextCurrency =
        dto.registrationFeeCurrencyCode?.trim().toUpperCase() ||
        existing.registration_fee_currency_code ||
        'USD';

      let receiptNumber = existing.registration_fee_receipt_number;

      if (nextStatus === 'PAID' && !receiptNumber) {
        const receiptResult = await client.query<{
          receipt_number: string;
        }>(
          `
          SELECT next_admission_receipt_number($1) AS receipt_number
          `,
          [dto.schoolId],
        );

        receiptNumber = receiptResult.rows[0].receipt_number;
      }

      const updatedResult = await client.query<{
        id: string;
        application_number: string;
        registration_fee_required: boolean;
        registration_fee_amount: string;
        registration_fee_currency_code: string;
        registration_fee_status: string;
        registration_payment_method: string | null;
        registration_payment_reference: string | null;
        registration_fee_paid_at: string | null;
        registration_fee_receipt_number: string | null;
        registration_payment_notes: string | null;
      }>(
        `
        UPDATE admission_applications
        SET
          registration_fee_required = $3,
          registration_fee_amount = $4,
          registration_fee_currency_code = $5,
          registration_fee_status = $6,
          registration_payment_method = $7,
          registration_payment_reference = $8,
          registration_fee_paid_at =
            CASE
              WHEN $6 = 'PAID' AND registration_fee_paid_at IS NULL THEN NOW()
              WHEN $6 <> 'PAID' THEN NULL
              ELSE registration_fee_paid_at
            END,
          registration_fee_receipt_number = $9,
          registration_payment_notes = $10,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        RETURNING
          id,
          application_number,
          registration_fee_required,
          registration_fee_amount::text AS registration_fee_amount,
          registration_fee_currency_code,
          registration_fee_status,
          registration_payment_method,
          registration_payment_reference,
          registration_fee_paid_at::text AS registration_fee_paid_at,
          registration_fee_receipt_number,
          registration_payment_notes
        `,
        [
          admissionApplicationId,
          dto.schoolId,
          nextRequired,
          nextAmount,
          nextCurrency,
          nextRequired ? nextStatus : 'NOT_REQUIRED',
          dto.registrationPaymentMethod?.trim() || null,
          dto.registrationPaymentReference?.trim() || null,
          receiptNumber,
          dto.registrationPaymentNotes?.trim() || null,
        ],
      );

      const updated = updatedResult.rows[0];

      await this.platformActivityService.recordTx(client, {
        eventType: 'ADMISSION_REGISTRATION_FEE_UPDATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Registration fee updated for admission ${updated.application_number}.`,
        payload: {
          admissionApplicationId,
          applicationNumber: updated.application_number,
          registrationFeeRequired: updated.registration_fee_required,
          registrationFeeStatus: updated.registration_fee_status,
          registrationFeeAmount: Number(updated.registration_fee_amount),
          currencyCode: updated.registration_fee_currency_code,
          receiptNumber: updated.registration_fee_receipt_number,
        },
      });

      return {
        id: updated.id,
        applicationNumber: updated.application_number,
        registrationFee: {
          required: updated.registration_fee_required,
          amount: Number(updated.registration_fee_amount),
          currencyCode: updated.registration_fee_currency_code,
          status: updated.registration_fee_status,
          paymentMethod: updated.registration_payment_method,
          paymentReference: updated.registration_payment_reference,
          paidAt: updated.registration_fee_paid_at,
          receiptNumber: updated.registration_fee_receipt_number,
          notes: updated.registration_payment_notes,
        },
      };
    });
  }
  async convertApplicationToStudent(
    admissionApplicationId: string,
    dto: ConvertAdmissionToStudentDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAdmissions(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const applicationResult = await client.query<{
        id: string;
        application_number: string;
        admission_status: string;
        academic_year_id: string | null;
        desired_section_id: string | null;
        first_name: string;
        last_name: string;
        gender: string | null;
        date_of_birth: string | null;
        place_of_birth: string | null;
        previous_school_name: string | null;
        previous_school_address: string | null;
        parent_full_name: string | null;
        parent_phone: string | null;
        parent_email: string | null;
        parent_profession: string | null;
        parent_address: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        photo_received: boolean;
        birth_certificate_received: boolean;
        vaccination_card_received: boolean;
        previous_school_record_received: boolean;
        parent_id_document_received: boolean;
        conduct_certificate_received: boolean;
        registration_fee_required: boolean;
        registration_fee_status: string;
        converted_student_id: string | null;
      }>(
        `
        SELECT
          id,
          application_number,
          admission_status,
          academic_year_id,
          desired_section_id,
          first_name,
          last_name,
          gender,
          date_of_birth::text AS date_of_birth,
          place_of_birth,
          previous_school_name,
          previous_school_address,
          parent_full_name,
          parent_phone,
          parent_email,
          parent_profession,
          parent_address,
          emergency_contact_name,
          emergency_contact_phone,
          photo_received,
          birth_certificate_received,
          vaccination_card_received,
          previous_school_record_received,
          parent_id_document_received,
          conduct_certificate_received,
          registration_fee_required,
          registration_fee_status,
          converted_student_id
        FROM admission_applications
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [admissionApplicationId, dto.schoolId],
      );

      const application = applicationResult.rows[0];

      if (!application) {
        throw new NotFoundException('Admission application not found.');
      }

      if (application.converted_student_id) {
        throw new BadRequestException(
          'This admission application has already been converted to a student file.',
        );
      }

      if (
        !['ADMITTED', 'CONDITIONALLY_ADMITTED', 'CONFIRMED'].includes(
          application.admission_status,
        )
      ) {
        throw new BadRequestException(
          'Only admitted or confirmed applications can be converted to student files.',
        );
      }

      if (
        application.registration_fee_required &&
        !['PAID', 'WAIVED'].includes(application.registration_fee_status)
      ) {
        throw new BadRequestException(
          'Registration fee is required and must be paid or waived before conversion.',
        );
      }

      const targetStudentStatus = dto.targetStudentStatus ?? 'REGISTERED';
      const sectionId = dto.sectionId ?? application.desired_section_id;

      if (!sectionId) {
        throw new BadRequestException(
          'A section/class assignment is required before converting an admission to a student file.',
        );
      }

      let section:
        | {
            id: string;
            academic_year_id: string;
            grade_level_id: string;
            start_date: string;
          }
        | undefined;

      if (sectionId) {
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
          [sectionId, dto.schoolId],
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
        student_status: string;
      }>(
        `
        WITH resolved_code AS (
          SELECT next_student_code($1) AS value
        )
        INSERT INTO students (
          school_id,
          student_number,
          student_code,
          first_name,
          last_name,
          status,
          gender,
          date_of_birth,
          admission_date,
          place_of_birth,
          previous_school_name,
          previous_school_address,
          photo_received,
          birth_certificate_received,
          vaccination_card_received,
          previous_school_record_received
        )
        SELECT
          $1,
          value,
          value,
          $2,
          $3,
          $4::student_status,
          $5,
          $6::date,
          CURRENT_DATE,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13
        FROM resolved_code
        RETURNING
          id,
          student_code,
          first_name,
          last_name,
          status::text AS student_status
        `,
        [
          dto.schoolId,
          application.first_name,
          application.last_name,
          targetStudentStatus,
          application.gender,
          application.date_of_birth,
          application.place_of_birth,
          application.previous_school_name,
          application.previous_school_address,
          application.photo_received,
          application.birth_certificate_received,
          application.vaccination_card_received,
          application.previous_school_record_received,
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
        VALUES ($1, $2, NULL, $3, $4, $5)
        `,
        [
          dto.schoolId,
          student.id,
          targetStudentStatus,
          `Created from admission application ${application.application_number}.`,
          actorUserId,
        ],
      );

      const documentRows = [
        ['PHOTO', application.photo_received],
        ['BIRTH_CERTIFICATE', application.birth_certificate_received],
        ['VACCINATION_CARD', application.vaccination_card_received],
        ['PREVIOUS_SCHOOL_RECORD', application.previous_school_record_received],
        ['PARENT_ID_DOCUMENT', application.parent_id_document_received],
        ['CONDUCT_CERTIFICATE', application.conduct_certificate_received],
      ];

      for (const [documentType, received] of documentRows) {
        await client.query(
          `
          INSERT INTO student_documents (
            school_id,
            student_id,
            document_type,
            document_status,
            received_at,
            notes
          )
          VALUES ($1, $2, $3, $4, $5::date, $6)
          `,
          [
            dto.schoolId,
            student.id,
            documentType,
            received ? 'RECEIVED' : 'PENDING',
            received ? new Date().toISOString().slice(0, 10) : null,
            `Created from admission application ${application.application_number}.`,
          ],
        );
      }

      let guardianId: string | null = null;
      let studentGuardianId: string | null = null;

      if ((dto.createGuardian ?? true) && application.parent_full_name) {
        const guardianResult = await client.query<{
          id: string;
        }>(
          `
          INSERT INTO guardians (
            school_id,
            full_name,
            profession,
            phone_primary,
            email,
            address
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
          `,
          [
            dto.schoolId,
            application.parent_full_name,
            application.parent_profession,
            application.parent_phone,
            application.parent_email,
            application.parent_address,
          ],
        );

        guardianId = guardianResult.rows[0].id;

        const relationship = dto.guardianRelationship ?? 'TUTOR';

        const relationResult = await client.query<{
          id: string;
        }>(
          `
          INSERT INTO student_guardians (
            school_id,
            student_id,
            guardian_id,
            relationship,
            relationship_type,
            is_primary_contact,
            is_emergency_contact,
            is_authorized_pickup,
            is_primary,
            can_pick_up
          )
          VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, TRUE, TRUE, TRUE)
          RETURNING id
          `,
          [dto.schoolId, student.id, guardianId, relationship, relationship],
        );

        studentGuardianId = relationResult.rows[0].id;
      }

      const previousAdmissionStatus = application.admission_status;

      await client.query(
        `
        UPDATE admission_applications
        SET
          admission_status = 'CONVERTED_TO_STUDENT',
          converted_student_id = $3,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        `,
        [admissionApplicationId, dto.schoolId, student.id],
      );

      await client.query(
        `
        INSERT INTO admission_status_history (
          school_id,
          admission_application_id,
          previous_status,
          new_status,
          reason,
          changed_by_user_id
        )
        VALUES ($1, $2, $3, 'CONVERTED_TO_STUDENT', $4, $5)
        `,
        [
          dto.schoolId,
          admissionApplicationId,
          previousAdmissionStatus,
          dto.conversionNote?.trim() ||
            `Converted to student file ${student.student_code ?? student.id}.`,
          actorUserId,
        ],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'ADMISSION_CONVERTED_TO_STUDENT',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Admission ${application.application_number} converted to student ${student.student_code ?? student.id}.`,
        payload: {
          admissionApplicationId,
          applicationNumber: application.application_number,
          studentId: student.id,
          studentCode: student.student_code,
          studentStatus: student.student_status,
          sectionId: section?.id ?? null,
          guardianId,
          studentGuardianId,
        },
      });

      return {
        admissionApplicationId,
        applicationNumber: application.application_number,
        student: {
          id: student.id,
          studentCode: student.student_code,
          firstName: student.first_name,
          lastName: student.last_name,
          studentStatus: student.student_status,
        },
        sectionId: section?.id ?? null,
        guardianId,
        studentGuardianId,
      };
    });
  }
  async updateApplication(
    admissionApplicationId: string,
    dto: UpdateAdmissionApplicationDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAdmissions(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const existingResult = await client.query<{
        id: string;
        application_number: string;
        admission_status: string;
        academic_year_id: string | null;
        desired_grade_level_id: string | null;
        desired_section_id: string | null;
        first_name: string;
        last_name: string;
        gender: string | null;
        date_of_birth: string | null;
        place_of_birth: string | null;
        previous_school_name: string | null;
        previous_school_address: string | null;
        parent_full_name: string | null;
        parent_phone: string | null;
        parent_email: string | null;
        parent_profession: string | null;
        parent_address: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        photo_received: boolean;
        birth_certificate_received: boolean;
        vaccination_card_received: boolean;
        previous_school_record_received: boolean;
        parent_id_document_received: boolean;
        conduct_certificate_received: boolean;
        notes: string | null;

        converted_student_id: string | null;
      }>(
        `
        SELECT
          id,
          application_number,
          admission_status,
          academic_year_id,
          desired_grade_level_id,
          desired_section_id,
          first_name,
          last_name,
          gender,
          date_of_birth::text AS date_of_birth,
          place_of_birth,
          previous_school_name,
          previous_school_address,
          parent_full_name,
          parent_phone,
          parent_email,
          parent_profession,
          parent_address,
          emergency_contact_name,
          emergency_contact_phone,
          photo_received,
          birth_certificate_received,
          vaccination_card_received,
          previous_school_record_received,
          parent_id_document_received,
          conduct_certificate_received,
          notes,
          converted_student_id
        FROM admission_applications
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [admissionApplicationId, dto.schoolId],
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        throw new NotFoundException('Admission application not found.');
      }

      if (existing.converted_student_id) {
        throw new BadRequestException(
          'This admission application has already been converted to a student file.',
        );
      }

      if (dto.academicYearId) {
        const academicYearResult = await client.query(
          `
          SELECT id
          FROM academic_years
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          LIMIT 1
          `,
          [dto.academicYearId, dto.schoolId],
        );

        if (!academicYearResult.rows[0]) {
          throw new NotFoundException(
            'Academic year not found for this school.',
          );
        }
      }

      if (dto.desiredGradeLevelId) {
        const gradeLevelResult = await client.query(
          `
          SELECT id
          FROM grade_levels
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          LIMIT 1
          `,
          [dto.desiredGradeLevelId, dto.schoolId],
        );

        if (!gradeLevelResult.rows[0]) {
          throw new NotFoundException('Grade level not found for this school.');
        }
      }

      if (dto.desiredSectionId) {
        const sectionResult = await client.query(
          `
          SELECT id
          FROM sections
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          LIMIT 1
          `,
          [dto.desiredSectionId, dto.schoolId],
        );

        if (!sectionResult.rows[0]) {
          throw new NotFoundException('Section not found for this school.');
        }
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
        application_number: string;
        admission_status: string;
        first_name: string;
        last_name: string;
      }>(
        `
        UPDATE admission_applications
        SET
          academic_year_id = $3,
          desired_grade_level_id = $4,
          desired_section_id = $5,
          first_name = $6,
          last_name = $7,
          gender = $8,
          date_of_birth = $9::date,
          place_of_birth = $10,
          previous_school_name = $11,
          previous_school_address = $12,
          parent_full_name = $13,
          parent_phone = $14,
          parent_email = $15,
          parent_profession = $16,
          parent_address = $17,
          emergency_contact_name = $18,
          emergency_contact_phone = $19,
          photo_received = $20,
          birth_certificate_received = $21,
          vaccination_card_received = $22,
          previous_school_record_received = $23,
          parent_id_document_received = $24,
          conduct_certificate_received = $25,
          notes = $26,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        RETURNING
          id,
          application_number,
          admission_status,
          first_name,
          last_name
        `,
        [
          admissionApplicationId,
          dto.schoolId,
          dto.academicYearId !== undefined
            ? dto.academicYearId || null
            : existing.academic_year_id,
          dto.desiredGradeLevelId !== undefined
            ? dto.desiredGradeLevelId || null
            : existing.desired_grade_level_id,
          dto.desiredSectionId !== undefined
            ? dto.desiredSectionId || null
            : existing.desired_section_id,
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
          dto.parentFullName !== undefined
            ? dto.parentFullName.trim() || null
            : existing.parent_full_name,
          dto.parentPhone !== undefined
            ? dto.parentPhone.trim() || null
            : existing.parent_phone,
          dto.parentEmail !== undefined
            ? dto.parentEmail.trim() || null
            : existing.parent_email,
          dto.parentProfession !== undefined
            ? dto.parentProfession.trim() || null
            : existing.parent_profession,
          dto.parentAddress !== undefined
            ? dto.parentAddress.trim() || null
            : existing.parent_address,
          dto.emergencyContactName !== undefined
            ? dto.emergencyContactName.trim() || null
            : existing.emergency_contact_name,
          dto.emergencyContactPhone !== undefined
            ? dto.emergencyContactPhone.trim() || null
            : existing.emergency_contact_phone,
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
          dto.parentIdDocumentReceived !== undefined
            ? dto.parentIdDocumentReceived
            : existing.parent_id_document_received,
          dto.conductCertificateReceived !== undefined
            ? dto.conductCertificateReceived
            : existing.conduct_certificate_received,
          dto.notes !== undefined ? dto.notes.trim() || null : existing.notes,
        ],
      );

      const updated = updatedResult.rows[0];

      await this.platformActivityService.recordTx(client, {
        eventType: 'ADMISSION_APPLICATION_UPDATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Admission application ${updated.application_number} updated.`,
        payload: {
          admissionApplicationId,
          applicationNumber: updated.application_number,
          admissionStatus: updated.admission_status,
        },
      });

      return {
        id: updated.id,
        applicationNumber: updated.application_number,
        admissionStatus: updated.admission_status,
        firstName: updated.first_name,
        lastName: updated.last_name,
      };
    });
  }
}
