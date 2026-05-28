"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  admissionStatusLabel,
  admissionStatusTone,
} from "@/components/admission-status-panel-client";
import {
  StudentDocumentRecord,
  StudentDocumentsPanelClient,
} from "@/components/student-documents-panel-client";
import { StudentAttendanceHistoryPanelClient } from "@/components/student-attendance-history-panel-client";
import { StudentCreateInvoicePanelClient } from "@/components/student-create-invoice-panel-client";
import { StudentFinanceSummaryPanelClient } from "@/components/student-finance-summary-panel-client";
import { StudentProfileEditPanelClient } from "@/components/student-profile-edit-panel-client";
import { StudentStatusPanelClient } from "@/components/student-status-panel-client";
import { StudentSectionAssignmentPanelClient } from "@/components/student-section-assignment-panel-client";
import { StudentGuardiansManagementPanelClient } from "@/components/student-guardians-management-panel-client";
import { StudentGuardianRow } from "@/components/student-guardians-panel-client";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type StudentProfile = {
  schoolId: string;
  student: {
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
    studentStatus: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    photoUrl: string | null;
    previousSchoolName: string | null;
    previousSchoolAddress: string | null;
    photoReceived: boolean;
    birthCertificateReceived: boolean;
    vaccinationCardReceived: boolean;
    previousSchoolRecordReceived: boolean;
    healthNotes: string | null;
    allergyNotes: string | null;
    medicalNotes: string | null;
    createdAt: string;
  };
  admissionSource: {
    id: string;
    applicationNumber: string;
    admissionStatus: string;
    firstName: string;
    lastName: string;
    createdAt: string;
  } | null;
  currentEnrollment: {
    enrollmentId: string;
    enrollmentStatus: string;
    section: {
      id: string;
      code: string | null;
      nameI18n: Record<string, string> | null;
    };
    gradeLevel: {
      id: string;
      code: string | null;
      nameI18n: Record<string, string> | null;
      academicDivision: string | null;
    };
  } | null;
  enrollmentHistory: Array<{
    enrollmentId: string;
    enrollmentStatus: string;
    section: {
      id: string;
      code: string | null;
      nameI18n: Record<string, string> | null;
    };
    gradeLevel: {
      id: string;
      code: string | null;
      nameI18n: Record<string, string> | null;
      academicDivision: string | null;
    };
    createdAt: string;
    updatedAt: string | null;
    endedAt: string | null;
  }>;
  statusHistory: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    reason: string | null;
    changedByUserId: string | null;
    changedAt: string;
  }>;
  documents: {
    photoReceived: boolean;
    birthCertificateReceived: boolean;
    vaccinationCardReceived: boolean;
    previousSchoolRecordReceived: boolean;
  };
  health: {
    vaccinationStatus: string | null;
    allergies: string | null;
    medicalNotes: string | null;
    specialNeeds: string | null;
  };
  documentRecords: StudentDocumentRecord[];
  guardians: StudentGuardianRow[];
  finance: {
    invoiceCount: number;
    overdueCount: number;
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
  };
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string | null;
    invoiceStatus: string;
    issueDate: string;
    dueDate: string | null;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    currencyCode: string;
  }>;
  recentPayments: Array<{
    id: string;
    receiptNumber: string | null;
    invoiceId: string | null;
    invoiceNumber: string | null;
    paymentStatus: string;
    paymentDate: string;
    amount: number;
    method: string | null;
    reference: string | null;
  }>;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
) {
  return value?.fr ?? value?.en ?? fallback;
}

function studentStatusLabel(status: string | null) {
  const labels: Record<string, string> = {
    PRE_REGISTERED: "PrÃƒÂ©inscrit",
    REGISTERED: "Inscrit",
    ACTIVE: "Actif",
    SUSPENDED: "Suspendu",
    WITHDRAWN: "RetirÃƒÂ©",
    TRANSFERRED: "TransfÃƒÂ©rÃƒÂ©",
    GRADUATED: "DiplÃƒÂ´mÃƒÂ©",
    ARCHIVED: "ArchivÃƒÂ©",
  };

  return status ? labels[status] ?? status : "Status pending";
}

function studentStatusTone(status: string | null): BadgeTone {
  if (status === "ACTIVE" || status === "GRADUATED") return "green";
  if (status === "REGISTERED" || status === "PRE_REGISTERED") return "blue";
  if (status === "SUSPENDED") return "amber";
  if (status && ["WITHDRAWN", "TRANSFERRED", "ARCHIVED"].includes(status)) {
    return "red";
  }
  return "neutral";
}

function studentName(profile: StudentProfile) {
  const name = `${profile.student.firstName ?? ""} ${
    profile.student.lastName ?? ""
  }`.trim();
  return name || profile.student.studentCode || "Student";
}

function currentEnrollmentLabel(profile: StudentProfile) {
  if (!profile.currentEnrollment) return "No class assigned";

  return enrollmentLabel(profile.currentEnrollment);
}

function enrollmentLabel(row: {
  section: {
    code: string | null;
    nameI18n: Record<string, string> | null;
  };
  gradeLevel: {
    code: string | null;
    nameI18n: Record<string, string> | null;
  };
}) {
  const grade = i18nName(row.gradeLevel.nameI18n, row.gradeLevel.code ?? "");
  const section = i18nName(row.section.nameI18n, row.section.code ?? "");

  if (section.toLowerCase().includes(grade.toLowerCase())) {
    return section;
  }

  return [grade, section].filter(Boolean).join(" - ") || "Unknown class";
}

function enrollmentStatusTone(status: string, endedAt: string | null): BadgeTone {
  if (!endedAt && status === "ACTIVE") return "green";
  if (status === "TRANSFERRED") return "amber";
  return "neutral";
}

export function StudentProfileClient({
  schoolId,
  studentId,
}: {
  schoolId: string;
  studentId: string;
}) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/school-students/${studentId}?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load student profile.");
      }

      setProfile(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load student profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, studentId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/students"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back to Students
          </Link>

          <Link
            href={`/students/${studentId}/edit`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Edit Profile
          </Link>

          <Link
            href={`/students/${studentId}/report-card`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Report Card
          </Link>
        </div>

        <button
          type="button"
          onClick={loadProfile}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading student profile...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {profile ? (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-wrap items-start gap-5">
                {profile.student.photoUrl ? (
                  <img
                    src={profile.student.photoUrl}
                    alt={studentName(profile)}
                    className="h-28 w-28 rounded-2xl border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-3xl font-bold text-slate-400">
                    {studentName(profile).slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                    Student Profile
                  </div>

                  <h2 className="mt-2 text-3xl font-bold text-slate-900">
                    {studentName(profile)}
                  </h2>

                  <div className="mt-1 text-sm text-slate-500">
                    {profile.student.studentCode ?? "Code pending"}
                  </div>
                </div>
              </div>

              <SchoolBadge tone={studentStatusTone(profile.student.studentStatus)}>
                {studentStatusLabel(profile.student.studentStatus)}
              </SchoolBadge>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Current Class</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {currentEnrollmentLabel(profile)}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Created</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {new Date(profile.student.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Student Code</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {profile.student.studentCode ?? "Code pending"}
                </div>
              </div>
            </div>
          </div>

          <StudentProfileEditPanelClient
            schoolId={schoolId}
            profile={profile}
            onUpdated={loadProfile}
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Current Class / Section
                </h3>

                <p className="mt-1 text-sm text-slate-600">
                  Active academic placement for this student.
                </p>

                <div className="mt-4 text-2xl font-bold text-slate-900">
                  {currentEnrollmentLabel(profile)}
                </div>

                {profile.currentEnrollment?.gradeLevel.academicDivision ? (
                  <div className="mt-1 text-sm text-slate-500">
                    {profile.currentEnrollment.gradeLevel.academicDivision}
                  </div>
                ) : null}
              </div>

              {profile.currentEnrollment ? (
                <SchoolBadge tone="green">Assigned</SchoolBadge>
              ) : (
                <SchoolBadge tone="amber">Not assigned</SchoolBadge>
              )}
            </div>
          </div>

          <StudentSectionAssignmentPanelClient
            schoolId={schoolId}
            studentId={profile.student.id}
            currentSectionId={profile.currentEnrollment?.section.id ?? null}
            onUpdated={loadProfile}
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Enrollment History
                </h3>

                <p className="mt-1 text-sm text-slate-600">
                  Historical class and section assignments for this student.
                </p>
              </div>

              <SchoolBadge tone="blue">
                {profile.enrollmentHistory.length} record(s)
              </SchoolBadge>
            </div>

            <div className="mt-5 space-y-3">
              {profile.enrollmentHistory.map((row) => (
                <div
                  key={row.enrollmentId}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {enrollmentLabel(row)}
                      </div>

                      {row.gradeLevel.academicDivision ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {row.gradeLevel.academicDivision}
                        </div>
                      ) : null}
                    </div>

                    <SchoolBadge
                      tone={enrollmentStatusTone(
                        row.enrollmentStatus,
                        row.endedAt,
                      )}
                    >
                      {!row.endedAt && row.enrollmentStatus === "ACTIVE"
                        ? "Current"
                        : row.enrollmentStatus}
                    </SchoolBadge>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                    <div>
                      Started:{" "}
                      <span className="font-medium text-slate-700">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      Ended:{" "}
                      <span className="font-medium text-slate-700">
                        {row.endedAt
                          ? new Date(row.endedAt).toLocaleDateString()
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {profile.enrollmentHistory.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No enrollment history found.
                </div>
              ) : null}
            </div>
          </div>

          <StudentStatusPanelClient
            schoolId={schoolId}
            studentId={profile.student.id}
            currentStatus={profile.student.studentStatus ?? "PRE_REGISTERED"}
            hasCurrentEnrollment={Boolean(profile.currentEnrollment)}
            statusHistory={profile.statusHistory}
            onUpdated={loadProfile}
          />

          {profile.admissionSource ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-blue-950">
                    Admission Source
                  </h3>

                  <p className="mt-1 text-sm text-blue-800">
                    This student file was created from an admission application.
                  </p>

                  <div className="mt-3 text-sm text-blue-900">
                    <div>
                      Application:{" "}
                      <span className="font-semibold">
                        {profile.admissionSource.applicationNumber}
                      </span>
                    </div>

                    <div>
                      Candidate:{" "}
                      <span className="font-semibold">
                        {profile.admissionSource.firstName}{" "}
                        {profile.admissionSource.lastName}
                      </span>
                    </div>

                    <div>
                      Created:{" "}
                      <span className="font-semibold">
                        {new Date(
                          profile.admissionSource.createdAt,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <SchoolBadge
                    tone={
                      admissionStatusTone(
                        profile.admissionSource.admissionStatus,
                      ) as any
                    }
                  >
                    {admissionStatusLabel(
                      profile.admissionSource.admissionStatus,
                    )}
                  </SchoolBadge>

                  <a
                    href={`/admissions/${profile.admissionSource.id}`}
                    className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                  >
                    Open Admission
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">Identity Details</h3>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Gender</span>
                  <span className="font-medium">
                    {profile.student.gender === "MALE"
                      ? "Boy / Garcon"
                      : profile.student.gender === "FEMALE"
                        ? "Girl / Fille"
                        : "-"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Date of birth</span>
                  <span className="font-medium">
                    {profile.student.dateOfBirth ?? "-"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Place of birth</span>
                  <span className="font-medium">
                    {profile.student.placeOfBirth ?? "-"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Previous school</span>
                  <span className="font-medium">
                    {profile.student.previousSchoolName ?? "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">Documents</h3>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Photo</span>
                  <SchoolBadge
                    tone={profile.documents.photoReceived ? "green" : "amber"}
                  >
                    {profile.documents.photoReceived ? "Received" : "Missing"}
                  </SchoolBadge>
                </div>

                <div className="flex justify-between">
                  <span>Birth certificate</span>
                  <SchoolBadge
                    tone={
                      profile.documents.birthCertificateReceived
                        ? "green"
                        : "amber"
                    }
                  >
                    {profile.documents.birthCertificateReceived
                      ? "Received"
                      : "Missing"}
                  </SchoolBadge>
                </div>

                <div className="flex justify-between">
                  <span>Vaccination card</span>
                  <SchoolBadge
                    tone={
                      profile.documents.vaccinationCardReceived
                        ? "green"
                        : "amber"
                    }
                  >
                    {profile.documents.vaccinationCardReceived
                      ? "Received"
                      : "Missing"}
                  </SchoolBadge>
                </div>

                <div className="flex justify-between">
                  <span>Previous school record</span>
                  <SchoolBadge
                    tone={
                      profile.documents.previousSchoolRecordReceived
                        ? "green"
                        : "amber"
                    }
                  >
                    {profile.documents.previousSchoolRecordReceived
                      ? "Received"
                      : "Missing"}
                  </SchoolBadge>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">Health</h3>

              <div className="mt-4 space-y-2 text-sm">
                <div>
                  <div className="text-slate-500">Vaccination status</div>
                  <div className="font-medium">
                    {profile.health.vaccinationStatus ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Allergies</div>
                  <div className="font-medium">
                    {profile.health.allergies ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Medical notes</div>
                  <div className="font-medium">
                    {profile.health.medicalNotes ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Special needs</div>
                  <div className="font-medium">
                    {profile.health.specialNeeds ?? "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <StudentDocumentsPanelClient
            schoolId={schoolId}
            studentId={profile.student.id}
            documents={profile.documentRecords}
            onChanged={loadProfile}
          />
          <StudentGuardiansManagementPanelClient
            schoolId={schoolId}
            studentId={profile.student.id}
            guardians={profile.guardians}
            onUpdated={loadProfile}
          />

          <StudentCreateInvoicePanelClient
            schoolId={schoolId}
            studentId={profile.student.id}
            onCreated={() => {
              setFinanceRefreshKey((value) => value + 1);
              loadProfile();
            }}
          />

          <StudentFinanceSummaryPanelClient
            schoolId={schoolId}
            studentId={profile.student.id}
            refreshKey={financeRefreshKey}
          />

          <StudentAttendanceHistoryPanelClient
            schoolId={schoolId}
            studentId={profile.student.id}
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Health / Medical
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-700">
                  Health notes
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {profile.student.healthNotes ?? "No health notes."}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-700">
                  Allergies
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {profile.student.allergyNotes ?? "No allergy notes."}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-700">
                  Medical notes
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {profile.student.medicalNotes ?? "No medical notes."}
                </div>
              </div>
            </div>
          </div>


          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Quick Actions
            </h3>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/attendance"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Open Attendance
              </Link>

              <Link
                href="/gradebooks"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Open Gradebooks
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}






