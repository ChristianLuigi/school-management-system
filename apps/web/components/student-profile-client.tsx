"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  StudentDocumentRecord,
  StudentDocumentsPanelClient,
} from "@/components/student-documents-panel-client";
import { StudentEditPanelClient } from "@/components/student-edit-panel-client";
import {
  StudentGuardianRow,
  StudentGuardiansPanelClient,
} from "@/components/student-guardians-panel-client";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type StudentProfile = {
  schoolId: string;
  student: {
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    photoUrl: string | null;
    previousSchoolName: string | null;
    previousSchoolAddress: string | null;
    createdAt: string;
  };
  currentEnrollment: {
    sectionId: string | null;
    sectionCode: string | null;
    sectionNameI18n: Record<string, string> | null;
    gradeLevelCode: string | null;
    gradeLevelNameI18n: Record<string, string> | null;
  };
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

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function statusTone(status: string): BadgeTone {
  if (status === "PAID" || status === "CONFIRMED") return "green";
  if (status === "OVERDUE") return "red";
  if (status === "PARTIALLY_PAID") return "amber";
  if (status === "VOID" || status === "CANCELLED") return "neutral";
  return "blue";
}

function studentName(profile: StudentProfile) {
  const name = `${profile.student.firstName ?? ""} ${
    profile.student.lastName ?? ""
  }`.trim();
  return name || profile.student.studentCode || "Student";
}

function classLabel(profile: StudentProfile) {
  const grade = i18nName(
    profile.currentEnrollment.gradeLevelNameI18n,
    profile.currentEnrollment.gradeLevelCode ?? "",
  );

  const section = i18nName(
    profile.currentEnrollment.sectionNameI18n,
    profile.currentEnrollment.sectionCode ?? "",
  );

  const value = [grade, section].filter(Boolean).join(" - ");
  return value || "No active class";
}

export function StudentProfileClient({
  schoolId,
  studentId,
}: {
  schoolId: string;
  studentId: string;
}) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
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

              <SchoolBadge tone="green">Active</SchoolBadge>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Current Class</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {classLabel(profile)}
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
          <StudentGuardiansPanelClient
            schoolId={schoolId}
            studentId={profile.student.id}
            guardians={profile.guardians}
            onChanged={loadProfile}
          />

          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Invoices</div>
              <div className="mt-2 text-2xl font-bold">
                {profile.finance.invoiceCount}
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm text-red-700">Overdue</div>
              <div className="mt-2 text-2xl font-bold text-red-900">
                {profile.finance.overdueCount}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Billed</div>
              <div className="mt-2 text-2xl font-bold">
                {money(profile.finance.totalBilled)}
              </div>
            </div>

            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="text-sm text-green-700">Paid</div>
              <div className="mt-2 text-2xl font-bold text-green-900">
                {money(profile.finance.totalPaid)}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm text-amber-700">Outstanding</div>
              <div className="mt-2 text-2xl font-bold text-amber-900">
                {money(profile.finance.totalOutstanding)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Quick Actions
            </h3>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/finance/students/${profile.student.id}/statement`}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Print Finance Statement
              </Link>

              <Link
                href="/finance"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Open Finance
              </Link>

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

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Recent Invoices
              </h3>

              <div className="mt-4 space-y-3">
                {profile.recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <Link
                        href={`/finance/invoices/${invoice.id}`}
                        className="font-medium text-slate-900 underline-offset-4 hover:underline"
                      >
                        {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                      </Link>

                      <SchoolBadge tone={statusTone(invoice.invoiceStatus)}>
                        {invoice.invoiceStatus}
                      </SchoolBadge>
                    </div>

                    <div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                      <div>
                        Total: {money(invoice.totalAmount, invoice.currencyCode)}
                      </div>
                      <div>
                        Paid: {money(invoice.amountPaid, invoice.currencyCode)}
                      </div>
                      <div>
                        Balance: {money(invoice.balanceDue, invoice.currencyCode)}
                      </div>
                    </div>
                  </div>
                ))}

                {profile.recentInvoices.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    No invoices found for this student.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Recent Payments
              </h3>

              <div className="mt-4 space-y-3">
                {profile.recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <Link
                        href={`/finance/payments/${payment.id}/receipt`}
                        className="font-medium text-slate-900 underline-offset-4 hover:underline"
                      >
                        {payment.receiptNumber ?? payment.id.slice(0, 8)}
                      </Link>

                      <SchoolBadge tone={statusTone(payment.paymentStatus)}>
                        {payment.paymentStatus}
                      </SchoolBadge>
                    </div>

                    <div className="mt-2 text-sm text-slate-600">
                      {payment.paymentDate} - {money(payment.amount)}
                      {payment.method ? ` - ${payment.method}` : ""}
                      {payment.reference ? ` - Ref: ${payment.reference}` : ""}
                    </div>
                  </div>
                ))}

                {profile.recentPayments.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    No payments found for this student.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}




