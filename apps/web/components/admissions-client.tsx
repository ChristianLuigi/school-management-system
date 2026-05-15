"use client";

import { useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type AdmissionApplicationRow = {
  id: string;
  applicationNumber: string;
  admissionStatus: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  parentFullName: string | null;
  parentPhone: string | null;
  desiredGradeLevelCode: string | null;
  desiredGradeLevelNameI18n: Record<string, string> | null;
  desiredSectionCode: string | null;
  desiredSectionNameI18n: Record<string, string> | null;
  createdAt: string;
};

const ADMISSION_STATUSES = [
  "PROSPECT",
  "APPLICATION_SUBMITTED",
  "DOCUMENTS_INCOMPLETE",
  "PENDING_PAYMENT",
  "PENDING_EXAM",
  "EXAM_SCHEDULED",
  "ADMITTED",
  "CONDITIONALLY_ADMITTED",
  "WAITLISTED",
  "REJECTED",
  "CONFIRMED",
  "CONVERTED_TO_STUDENT",
  "CANCELLED",
];

function admissionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PROSPECT: "Prospect",
    APPLICATION_SUBMITTED: "Demande soumise",
    DOCUMENTS_INCOMPLETE: "Documents incomplets",
    PENDING_PAYMENT: "En attente de paiement",
    PENDING_EXAM: "En attente d'examen",
    EXAM_SCHEDULED: "Examen planifie",
    ADMITTED: "Admis",
    CONDITIONALLY_ADMITTED: "Admis sous condition",
    WAITLISTED: "Liste d'attente",
    REJECTED: "Refuse",
    CONFIRMED: "Confirme",
    CONVERTED_TO_STUDENT: "Converti en eleve",
    CANCELLED: "Annule",
  };

  return labels[status] ?? status;
}

function admissionStatusTone(status: string) {
  if (status === "ADMITTED" || status === "CONFIRMED") return "green";
  if (status === "REJECTED" || status === "CANCELLED") return "red";
  if (status === "DOCUMENTS_INCOMPLETE" || status === "PENDING_PAYMENT") {
    return "amber";
  }
  if (status === "CONVERTED_TO_STUDENT") return "neutral";
  return "blue";
}

function i18nName(value: Record<string, string> | null | undefined, fallback: string) {
  return value?.fr ?? value?.en ?? fallback;
}

function desiredClassLabel(row: AdmissionApplicationRow) {
  const grade = i18nName(
    row.desiredGradeLevelNameI18n,
    row.desiredGradeLevelCode ?? "",
  );

  const section = i18nName(
    row.desiredSectionNameI18n,
    row.desiredSectionCode ?? "",
  );

  const label = [grade, section].filter(Boolean).join(" - ");
  return label || "-";
}

export function AdmissionsClient({
  schoolId,
  canCreate,
}: {
  schoolId: string;
  canCreate: boolean;
}) {
  const [rows, setRows] = useState<AdmissionApplicationRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [previousSchoolName, setPreviousSchoolName] = useState("");
  const [previousSchoolAddress, setPreviousSchoolAddress] = useState("");

  const [parentFullName, setParentFullName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentProfession, setParentProfession] = useState("");
  const [parentAddress, setParentAddress] = useState("");

  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const [photoReceived, setPhotoReceived] = useState(false);
  const [birthCertificateReceived, setBirthCertificateReceived] = useState(false);
  const [vaccinationCardReceived, setVaccinationCardReceived] = useState(false);
  const [previousSchoolRecordReceived, setPreviousSchoolRecordReceived] =
    useState(false);
  const [parentIdDocumentReceived, setParentIdDocumentReceived] = useState(false);
  const [conductCertificateReceived, setConductCertificateReceived] =
    useState(false);

  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadApplications() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (status) {
        params.set("status", status);
      }

      const res = await fetch(`/api/admissions?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load admissions.");
      }

      setRows(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admissions.");
    } finally {
      setLoading(false);
    }
  }

  async function createApplication() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error("First name and last name are required.");
      }

      const res = await fetch("/api/admissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          firstName,
          lastName,
          gender: gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          placeOfBirth,
          previousSchoolName,
          previousSchoolAddress,
          parentFullName,
          parentPhone,
          parentEmail: parentEmail || undefined,
          parentProfession,
          parentAddress,
          emergencyContactName,
          emergencyContactPhone,
          photoReceived,
          birthCertificateReceived,
          vaccinationCardReceived,
          previousSchoolRecordReceived,
          parentIdDocumentReceived,
          conductCertificateReceived,
          notes,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create admission application.");
      }

      setMessage(`Admission application created: ${body.applicationNumber}`);
      setOpenCreate(false);

      setFirstName("");
      setLastName("");
      setGender("");
      setDateOfBirth("");
      setPlaceOfBirth("");
      setPreviousSchoolName("");
      setPreviousSchoolAddress("");
      setParentFullName("");
      setParentPhone("");
      setParentEmail("");
      setParentProfession("");
      setParentAddress("");
      setEmergencyContactName("");
      setEmergencyContactPhone("");
      setPhotoReceived(false);
      setBirthCertificateReceived(false);
      setVaccinationCardReceived(false);
      setPreviousSchoolRecordReceived(false);
      setParentIdDocumentReceived(false);
      setConductCertificateReceived(false);
      setNotes("");

      await loadApplications();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create admission application.",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Admissions
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Create and track admission applications before converting them into official student files.
            </p>
          </div>

          {canCreate ? (
            <button
              type="button"
              onClick={() => setOpenCreate((value) => !value)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {openCreate ? "Close" : "New Admission"}
            </button>
          ) : null}
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {openCreate && canCreate ? (
          <div className="mt-5 space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <h4 className="font-semibold text-slate-900">
                Student Information
              </h4>

              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="First name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />

                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />

                <select
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                >
                  <option value="">Gender</option>
                  <option value="MALE">Boy / Garcon</option>
                  <option value="FEMALE">Girl / Fille</option>
                </select>

                <input
                  type="date"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />

                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                  placeholder="Place of birth"
                  value={placeOfBirth}
                  onChange={(event) => setPlaceOfBirth(event.target.value)}
                />

                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                  placeholder="Previous school name"
                  value={previousSchoolName}
                  onChange={(event) => setPreviousSchoolName(event.target.value)}
                />

                <textarea
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                  placeholder="Previous school address"
                  value={previousSchoolAddress}
                  onChange={(event) =>
                    setPreviousSchoolAddress(event.target.value)
                  }
                />
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900">
                Parent / Guardian Information
              </h4>

              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                  placeholder="Parent / guardian full name"
                  value={parentFullName}
                  onChange={(event) => setParentFullName(event.target.value)}
                />

                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Parent phone"
                  value={parentPhone}
                  onChange={(event) => setParentPhone(event.target.value)}
                />

                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Parent email"
                  value={parentEmail}
                  onChange={(event) => setParentEmail(event.target.value)}
                />

                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Parent profession"
                  value={parentProfession}
                  onChange={(event) => setParentProfession(event.target.value)}
                />

                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Emergency contact phone"
                  value={emergencyContactPhone}
                  onChange={(event) =>
                    setEmergencyContactPhone(event.target.value)
                  }
                />

                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                  placeholder="Emergency contact name"
                  value={emergencyContactName}
                  onChange={(event) =>
                    setEmergencyContactName(event.target.value)
                  }
                />

                <textarea
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                  placeholder="Parent address"
                  value={parentAddress}
                  onChange={(event) => setParentAddress(event.target.value)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="font-semibold text-slate-900">
                Document Checklist
              </h4>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={photoReceived}
                    onChange={(event) => setPhotoReceived(event.target.checked)}
                  />
                  Photo received
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={birthCertificateReceived}
                    onChange={(event) =>
                      setBirthCertificateReceived(event.target.checked)
                    }
                  />
                  Birth certificate received
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={vaccinationCardReceived}
                    onChange={(event) =>
                      setVaccinationCardReceived(event.target.checked)
                    }
                  />
                  Vaccination card received
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={previousSchoolRecordReceived}
                    onChange={(event) =>
                      setPreviousSchoolRecordReceived(event.target.checked)
                    }
                  />
                  Previous school record received
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={parentIdDocumentReceived}
                    onChange={(event) =>
                      setParentIdDocumentReceived(event.target.checked)
                    }
                  />
                  Parent ID document received
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={conductCertificateReceived}
                    onChange={(event) =>
                      setConductCertificateReceived(event.target.checked)
                    }
                  />
                  Conduct certificate received
                </label>
              </div>
            </div>

            <textarea
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Administrative notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />

            <button
              type="button"
              disabled={saving}
              onClick={createApplication}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Admission Application"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold text-slate-900">
              Admission Applications
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              Search by application number, student name, parent name, or phone.
            </p>
          </div>

          <button
            type="button"
            onClick={loadApplications}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <input
            className="min-w-[280px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search admissions..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {ADMISSION_STATUSES.map((item) => (
              <option key={item} value={item}>
                {admissionStatusLabel(item)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadApplications}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Search
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Desired Class</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {row.applicationNumber}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {row.firstName} {row.lastName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.gender === "MALE"
                        ? "Boy / Garcon"
                        : row.gender === "FEMALE"
                          ? "Girl / Fille"
                          : "-"}
                    </div>
                  </td>

                  <td className="px-4 py-3">{desiredClassLabel(row)}</td>

                  <td className="px-4 py-3">
                    <div>{row.parentFullName ?? "-"}</div>
                    <div className="text-xs text-slate-500">
                      {row.parentPhone ?? "-"}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <SchoolBadge tone={admissionStatusTone(row.admissionStatus) as any}>
                      {admissionStatusLabel(row.admissionStatus)}
                    </SchoolBadge>
                  </td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No admission applications found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
