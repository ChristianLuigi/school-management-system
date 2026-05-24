"use client";

import { useState } from "react";
import Link from "next/link";
import { SectionSelectorClient } from "@/components/section-selector-client";
import { SchoolBadge } from "@/components/school-ui";

type AdmissionForConversion = {
  id: string;
  admissionStatus: string;
  convertedStudent: {
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  candidate: {
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
  };
  parent: {
    fullName: string | null;
    phone?: string | null;
  };
  desiredSection: {
    id: string;
    code: string | null;
    nameI18n: Record<string, string> | null;
  } | null;
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

function i18nName(value: Record<string, string> | null | undefined, fallback: string) {
  return value?.fr ?? value?.en ?? fallback;
}

function canConvert(status: string) {
  return ["ADMITTED", "CONDITIONALLY_ADMITTED", "CONFIRMED"].includes(status);
}

function getConversionChecks(
  application: AdmissionForConversion,
  sectionId: string,
) {
  return [
    {
      label: "Admission decision is positive",
      ok: canConvert(application.admissionStatus),
    },
    {
      label: "Student identity is completed",
      ok:
        Boolean(application.candidate.firstName) &&
        Boolean(application.candidate.lastName),
    },
    {
      label: "Date of birth is provided",
      ok: Boolean(application.candidate.dateOfBirth),
    },
    {
      label: "Parent/guardian is identified",
      ok: Boolean(application.parent.fullName),
    },
    {
      label: "Final class/section is selected",
      ok: Boolean(sectionId),
    },
    {
      label: "Registration fee is settled",
      ok:
        !application.registrationFee?.required ||
        ["PAID", "WAIVED"].includes(application.registrationFee.status),
    },
  ];
}

function allChecksPassed(checks: Array<{ ok: boolean }>) {
  return checks.every((check) => check.ok);
}

export function AdmissionConvertPanelClient({
  schoolId,
  application,
  onConverted,
}: {
  schoolId: string;
  application: AdmissionForConversion;
  onConverted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetStudentStatus, setTargetStudentStatus] = useState<
    "PRE_REGISTERED" | "REGISTERED" | "ACTIVE"
  >("REGISTERED");
  const [sectionId, setSectionId] = useState(application.desiredSection?.id ?? "");
  const [createGuardian, setCreateGuardian] = useState(true);
  const [guardianRelationship, setGuardianRelationship] = useState<
    "MOTHER" | "FATHER" | "TUTOR" | "OTHER"
  >("TUTOR");
  const [conversionNote, setConversionNote] = useState("");
  const [convertedStudentId, setConvertedStudentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const conversionChecks = getConversionChecks(application, sectionId);
  const readyToConvert = allChecksPassed(conversionChecks);

  async function convertApplication() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!readyToConvert) {
        throw new Error("Complete the conversion readiness checklist first.");
      }

      const res = await fetch(`/api/admissions/${application.id}/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          targetStudentStatus,
          sectionId: sectionId || undefined,
          createGuardian,
          guardianRelationship,
          conversionNote,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to convert admission application.");
      }

      setConvertedStudentId(body.student.id);
      setMessage(
        `Application converted successfully: ${body.student.studentCode ?? body.student.id}`,
      );
      setOpen(false);
      onConverted();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to convert admission application.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (application.convertedStudent) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-green-900">
              Student File Created
            </h3>
            <p className="mt-1 text-sm text-green-800">
              This application has already been converted into an official student file.
            </p>
            <div className="mt-2 text-sm text-green-800">
              {application.convertedStudent.firstName}{" "}
              {application.convertedStudent.lastName} -{" "}
              {application.convertedStudent.studentCode ?? "Code pending"}
            </div>
          </div>

          <SchoolBadge tone="green">Converted</SchoolBadge>
        </div>

        <Link
          href={`/students/${application.convertedStudent.id}`}
          className="mt-4 inline-flex rounded-xl bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          Open Student Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Convert to Student
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Create the official student file from this admission application.
          </p>
        </div>

        {canConvert(application.admissionStatus) ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {open ? "Close" : "Convert"}
          </button>
        ) : (
          <SchoolBadge tone="amber">Not ready</SchoolBadge>
        )}
      </div>

      {canConvert(application.admissionStatus) ? (
        <div className="mt-4">
          <Link
            href={`/admissions/${application.id}/decision-letter`}
            className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Print admission letter
          </Link>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="font-semibold text-slate-900">
          Conversion readiness
        </div>

        <div className="mt-3 space-y-2">
          {conversionChecks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span>{check.label}</span>

              <SchoolBadge tone={check.ok ? "green" : "amber"}>
                {check.ok ? "OK" : "Missing"}
              </SchoolBadge>
            </div>
          ))}
        </div>
      </div>

      {!canConvert(application.admissionStatus) ? (
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Application must be admitted, conditionally admitted, or confirmed before conversion.
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <div>{message}</div>

          {convertedStudentId ? (
            <Link
              href={`/students/${convertedStudentId}`}
              className="mt-3 inline-flex rounded-lg bg-green-700 px-3 py-2 text-xs font-medium text-white hover:bg-green-800"
            >
              Open Student Profile
            </Link>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {open && canConvert(application.admissionStatus) ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Student status after conversion
            </span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={targetStudentStatus}
              onChange={(event) =>
                setTargetStudentStatus(
                  event.target.value as "PRE_REGISTERED" | "REGISTERED" | "ACTIVE",
                )
              }
            >
              <option value="REGISTERED">Inscrit</option>
              <option value="PRE_REGISTERED">Pre-inscrit</option>
              <option value="ACTIVE">Actif</option>
            </select>
          </label>

          {application.desiredSection ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Requested class:{" "}
              <span className="font-semibold">
                {i18nName(
                  application.desiredSection.nameI18n,
                  application.desiredSection.code ?? "-",
                )}
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No requested class was selected for this admission application.
            </div>
          )}

          <SectionSelectorClient
            schoolId={schoolId}
            sectionId={sectionId}
            onSectionIdChange={setSectionId}
            label="Affectation finale classe / section"
            allowEmpty
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createGuardian}
                onChange={(event) => setCreateGuardian(event.target.checked)}
              />
              Create guardian from parent information
            </label>

            {createGuardian ? (
              <select
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                value={guardianRelationship}
                onChange={(event) =>
                  setGuardianRelationship(
                    event.target.value as "MOTHER" | "FATHER" | "TUTOR" | "OTHER",
                  )
                }
              >
                <option value="MOTHER">Mother / Mere</option>
                <option value="FATHER">Father / Pere</option>
                <option value="TUTOR">Tutor / Tuteur</option>
                <option value="OTHER">Other / Autre</option>
              </select>
            ) : null}

            {createGuardian && !application.parent.fullName ? (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                No parent/guardian name is currently recorded. No guardian will be created unless parent information exists.
              </div>
            ) : null}
          </div>

          <textarea
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Conversion note optional"
            value={conversionNote}
            onChange={(event) => setConversionNote(event.target.value)}
          />

          <button
            type="button"
            disabled={saving || !readyToConvert}
            onClick={convertApplication}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Converting..."
              : readyToConvert
                ? "Convert to Student"
                : "Complete dossier before conversion"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
