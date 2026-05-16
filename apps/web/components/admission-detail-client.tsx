"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdmissionConvertPanelClient } from "@/components/admission-convert-panel-client";
import { AdmissionExamPanelClient } from "@/components/admission-exam-panel-client";
import { AdmissionEditPanelClient } from "@/components/admission-edit-panel-client";
import { AdmissionReadinessPanelClient } from "@/components/admission-readiness-panel-client";
import { AdmissionRegistrationFeePanelClient } from "@/components/admission-registration-fee-panel-client";
import { SchoolBadge } from "@/components/school-ui";
import {
  AdmissionStatusHistoryRow,
  AdmissionStatusPanelClient,
  admissionStatusLabel,
  admissionStatusTone,
} from "@/components/admission-status-panel-client";

type AdmissionApplicationDetails = {
  id: string;
  schoolId: string;
  applicationNumber: string;
  admissionStatus: string;
  academicYear: {
    id: string;
    nameI18n: Record<string, string> | null;
  } | null;
  desiredGradeLevel: {
    id: string;
    code: string | null;
    nameI18n: Record<string, string> | null;
  } | null;
  desiredSection: {
    id: string;
    code: string | null;
    nameI18n: Record<string, string> | null;
  } | null;
  candidate: {
    firstName: string;
    lastName: string;
    gender: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    previousSchoolName: string | null;
    previousSchoolAddress: string | null;
  };
  parent: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    profession: string | null;
    address: string | null;
  };
  emergencyContact: {
    name: string | null;
    phone: string | null;
  };
  documents: {
    photoReceived: boolean;
    birthCertificateReceived: boolean;
    vaccinationCardReceived: boolean;
    previousSchoolRecordReceived: boolean;
    parentIdDocumentReceived: boolean;
    conductCertificateReceived: boolean;
  };
  notes: string | null;
  registrationFee: {
    required: boolean;
    amount: number;
    currencyCode: string;
    status: string;
    paymentMethod: string | null;
    paymentReference: string | null;
    paidAt: string | null;
    receiptNumber: string | null;
    notes: string | null;
  };
  exam: {
    id: string;
    examStatus: string;
    scheduledAt: string | null;
    location: string | null;
    supervisorName: string | null;
    frenchScore: number | null;
    mathScore: number | null;
    englishScore: number | null;
    generalScore: number | null;
    interviewScore: number | null;
    totalScore: number | null;
    maxScore: number;
    decisionStatus: string | null;
    notes: string | null;
    updatedAt: string;
  } | null;  convertedStudent: {
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  statusHistory: AdmissionStatusHistoryRow[];
  createdAt: string;
  updatedAt: string;
};

function i18nName(value: Record<string, string> | null | undefined, fallback: string) {
  return value?.fr ?? value?.en ?? fallback;
}

function formatGender(value: string | null) {
  if (value === "MALE") return "Boy / Garcon";
  if (value === "FEMALE") return "Girl / Fille";
  return "-";
}

function documentBadge(received: boolean) {
  return (
    <SchoolBadge tone={received ? "green" : "amber"}>
      {received ? "Received" : "Missing"}
    </SchoolBadge>
  );
}

export function AdmissionDetailClient({
  schoolId,
  admissionApplicationId,
}: {
  schoolId: string;
  admissionApplicationId: string;
}) {
  const [application, setApplication] =
    useState<AdmissionApplicationDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadApplication() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/admissions/${admissionApplicationId}?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load admission application.");
      }

      setApplication(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load admission application.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, admissionApplicationId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admissions"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Back to Admissions
        </Link>

        <button
          type="button"
          onClick={loadApplication}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading admission application...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {application ? (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                  Admission Application
                </div>

                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  {application.candidate.firstName}{" "}
                  {application.candidate.lastName}
                </h2>

                <div className="mt-1 text-sm text-slate-500">
                  {application.applicationNumber}
                </div>
              </div>

              <SchoolBadge
                tone={admissionStatusTone(application.admissionStatus) as any}
              >
                {admissionStatusLabel(application.admissionStatus)}
              </SchoolBadge>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Desired level</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {application.desiredGradeLevel
                    ? i18nName(
                        application.desiredGradeLevel.nameI18n,
                        application.desiredGradeLevel.code ?? "-",
                      )
                    : "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Desired section</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {application.desiredSection
                    ? i18nName(
                        application.desiredSection.nameI18n,
                        application.desiredSection.code ?? "-",
                      )
                    : "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Created</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {new Date(application.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>


          <AdmissionReadinessPanelClient application={application} />

          <AdmissionRegistrationFeePanelClient
            schoolId={schoolId}
            admissionApplicationId={application.id}
            fee={application.registrationFee}
            convertedStudentId={application.convertedStudent?.id ?? null}
            onUpdated={loadApplication}
          />

          <AdmissionExamPanelClient
            schoolId={schoolId}
            admissionApplicationId={application.id}
            exam={application.exam}
            convertedStudentId={application.convertedStudent?.id ?? null}
            onUpdated={loadApplication}
          />

          <AdmissionConvertPanelClient
            schoolId={schoolId}
            application={application}
            onConverted={loadApplication}
          />

          <AdmissionEditPanelClient
            schoolId={schoolId}
            application={application}
            onUpdated={loadApplication}
          />

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">Candidate</h3>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Gender</span>
                  <span className="font-medium">
                    {formatGender(application.candidate.gender)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Date of birth</span>
                  <span className="font-medium">
                    {application.candidate.dateOfBirth ?? "-"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Place of birth</span>
                  <span className="font-medium">
                    {application.candidate.placeOfBirth ?? "-"}
                  </span>
                </div>

                <div>
                  <div className="text-slate-500">Previous school</div>
                  <div className="font-medium">
                    {application.candidate.previousSchoolName ?? "-"}
                  </div>
                  <div className="text-slate-600">
                    {application.candidate.previousSchoolAddress ?? ""}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">
                Parent / Guardian
              </h3>

              <div className="mt-4 space-y-2 text-sm">
                <div>
                  <div className="text-slate-500">Name</div>
                  <div className="font-medium">
                    {application.parent.fullName ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Phone</div>
                  <div className="font-medium">
                    {application.parent.phone ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Email</div>
                  <div className="font-medium">
                    {application.parent.email ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Profession</div>
                  <div className="font-medium">
                    {application.parent.profession ?? "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">
                Emergency Contact
              </h3>

              <div className="mt-4 space-y-2 text-sm">
                <div>
                  <div className="text-slate-500">Name</div>
                  <div className="font-medium">
                    {application.emergencyContact.name ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Phone</div>
                  <div className="font-medium">
                    {application.emergencyContact.phone ?? "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">Documents</h3>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="flex justify-between rounded-xl border border-slate-200 p-3 text-sm">
                <span>Photo</span>
                {documentBadge(application.documents.photoReceived)}
              </div>

              <div className="flex justify-between rounded-xl border border-slate-200 p-3 text-sm">
                <span>Birth certificate</span>
                {documentBadge(application.documents.birthCertificateReceived)}
              </div>

              <div className="flex justify-between rounded-xl border border-slate-200 p-3 text-sm">
                <span>Vaccination card</span>
                {documentBadge(application.documents.vaccinationCardReceived)}
              </div>

              <div className="flex justify-between rounded-xl border border-slate-200 p-3 text-sm">
                <span>Previous school record</span>
                {documentBadge(application.documents.previousSchoolRecordReceived)}
              </div>

              <div className="flex justify-between rounded-xl border border-slate-200 p-3 text-sm">
                <span>Parent ID document</span>
                {documentBadge(application.documents.parentIdDocumentReceived)}
              </div>

              <div className="flex justify-between rounded-xl border border-slate-200 p-3 text-sm">
                <span>Conduct certificate</span>
                {documentBadge(application.documents.conductCertificateReceived)}
              </div>
            </div>
          </div>

          {application.notes ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">
                Administrative Notes
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                {application.notes}
              </p>
            </div>
          ) : null}

          <AdmissionStatusPanelClient
            schoolId={schoolId}
            admissionApplicationId={application.id}
            currentStatus={application.admissionStatus}
            statusHistory={application.statusHistory}
            convertedStudentId={application.convertedStudent?.id ?? null}
            onChanged={loadApplication}
          />
        </>
      ) : null}
    </div>
  );
}
