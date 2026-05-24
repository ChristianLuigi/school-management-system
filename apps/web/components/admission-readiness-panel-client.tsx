"use client";

import { SchoolBadge } from "@/components/school-ui";

type AdmissionReadinessInput = {
  desiredSection?: {
    id: string;
  } | null;
  candidate: {
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
  };
  parent: {
    fullName: string | null;
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
  registrationFee?: {
    required: boolean;
    status: string;
  };
};

export function AdmissionReadinessPanelClient({
  application,
}: {
  application: AdmissionReadinessInput;
}) {
  const checks = [
    {
      label: "Desired class / section selected",
      ok: Boolean(application.desiredSection?.id),
    },
    {
      label: "Student identity completed",
      ok:
        Boolean(application.candidate.firstName) &&
        Boolean(application.candidate.lastName),
    },
    {
      label: "Date of birth provided",
      ok: Boolean(application.candidate.dateOfBirth),
    },
    {
      label: "Parent/guardian identified",
      ok: Boolean(application.parent.fullName),
    },
    {
      label: "Parent phone provided",
      ok: Boolean(application.parent.phone),
    },
    {
      label: "Photo received",
      ok: application.documents.photoReceived,
    },
    {
      label: "Birth certificate received",
      ok: application.documents.birthCertificateReceived,
    },
    {
      label: "Vaccination card received",
      ok: application.documents.vaccinationCardReceived,
    },
    {
      label: "Previous school record received",
      ok: application.documents.previousSchoolRecordReceived,
    },
    {
      label: "Registration fee settled",
      ok:
        !application.registrationFee?.required ||
        ["PAID", "WAIVED"].includes(application.registrationFee.status),
    },
  ];

  const completed = checks.filter((check) => check.ok).length;
  const total = checks.length;
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Admission Readiness
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Quick checklist before confirming admission or converting to a student file.
          </p>
        </div>

        <SchoolBadge tone={percentage >= 80 ? "green" : percentage >= 50 ? "amber" : "red"}>
          {percentage}%
        </SchoolBadge>
      </div>

      <div className="mt-5 space-y-2">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
          >
            <span>{check.label}</span>

            <SchoolBadge tone={check.ok ? "green" : "amber"}>
              {check.ok ? "OK" : "Missing"}
            </SchoolBadge>
          </div>
        ))}
      </div>
    </div>
  );
}
