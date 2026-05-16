"use client";

import { useEffect, useState } from "react";
import { SectionSelectorClient } from "@/components/section-selector-client";

type AdmissionApplicationForEdit = {
  id: string;
  admissionStatus: string;
  convertedStudent: {
    id: string;
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
};

export function AdmissionEditPanelClient({
  schoolId,
  application,
  onUpdated,
}: {
  schoolId: string;
  application: AdmissionApplicationForEdit;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);

  const [firstName, setFirstName] = useState(application.candidate.firstName);
  const [lastName, setLastName] = useState(application.candidate.lastName);
  const [gender, setGender] = useState(application.candidate.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(
    application.candidate.dateOfBirth ?? "",
  );
  const [placeOfBirth, setPlaceOfBirth] = useState(
    application.candidate.placeOfBirth ?? "",
  );
  const [previousSchoolName, setPreviousSchoolName] = useState(
    application.candidate.previousSchoolName ?? "",
  );
  const [previousSchoolAddress, setPreviousSchoolAddress] = useState(
    application.candidate.previousSchoolAddress ?? "",
  );
  const [desiredSectionId, setDesiredSectionId] = useState(
    application.desiredSection?.id ?? "",
  );

  const [parentFullName, setParentFullName] = useState(
    application.parent.fullName ?? "",
  );
  const [parentPhone, setParentPhone] = useState(application.parent.phone ?? "");
  const [parentEmail, setParentEmail] = useState(application.parent.email ?? "");
  const [parentProfession, setParentProfession] = useState(
    application.parent.profession ?? "",
  );
  const [parentAddress, setParentAddress] = useState(
    application.parent.address ?? "",
  );

  const [emergencyContactName, setEmergencyContactName] = useState(
    application.emergencyContact.name ?? "",
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    application.emergencyContact.phone ?? "",
  );

  const [photoReceived, setPhotoReceived] = useState(
    application.documents.photoReceived,
  );
  const [birthCertificateReceived, setBirthCertificateReceived] = useState(
    application.documents.birthCertificateReceived,
  );
  const [vaccinationCardReceived, setVaccinationCardReceived] = useState(
    application.documents.vaccinationCardReceived,
  );
  const [previousSchoolRecordReceived, setPreviousSchoolRecordReceived] =
    useState(application.documents.previousSchoolRecordReceived);
  const [parentIdDocumentReceived, setParentIdDocumentReceived] = useState(
    application.documents.parentIdDocumentReceived,
  );
  const [conductCertificateReceived, setConductCertificateReceived] = useState(
    application.documents.conductCertificateReceived,
  );

  const [notes, setNotes] = useState(application.notes ?? "");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFirstName(application.candidate.firstName);
    setLastName(application.candidate.lastName);
    setGender(application.candidate.gender ?? "");
    setDateOfBirth(application.candidate.dateOfBirth ?? "");
    setPlaceOfBirth(application.candidate.placeOfBirth ?? "");
    setPreviousSchoolName(application.candidate.previousSchoolName ?? "");
    setPreviousSchoolAddress(application.candidate.previousSchoolAddress ?? "");
    setDesiredSectionId(application.desiredSection?.id ?? "");

    setParentFullName(application.parent.fullName ?? "");
    setParentPhone(application.parent.phone ?? "");
    setParentEmail(application.parent.email ?? "");
    setParentProfession(application.parent.profession ?? "");
    setParentAddress(application.parent.address ?? "");

    setEmergencyContactName(application.emergencyContact.name ?? "");
    setEmergencyContactPhone(application.emergencyContact.phone ?? "");

    setPhotoReceived(application.documents.photoReceived);
    setBirthCertificateReceived(application.documents.birthCertificateReceived);
    setVaccinationCardReceived(application.documents.vaccinationCardReceived);
    setPreviousSchoolRecordReceived(
      application.documents.previousSchoolRecordReceived,
    );
    setParentIdDocumentReceived(application.documents.parentIdDocumentReceived);
    setConductCertificateReceived(application.documents.conductCertificateReceived);

    setNotes(application.notes ?? "");
  }, [application]);

  async function saveApplication() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error("First name and last name are required.");
      }

      const res = await fetch(`/api/admissions/${application.id}`, {
        method: "PATCH",
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
          desiredSectionId: desiredSectionId || null,
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
        throw new Error(body?.message ?? "Failed to update admission application.");
      }

      setMessage("Admission application updated successfully.");
      setOpen(false);
      onUpdated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update admission application.",
      );
    } finally {
      setSaving(false);
    }
  }

  const locked = Boolean(application.convertedStudent);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Application Information
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Update candidate information, parent contact, documents, and notes.
          </p>
        </div>

        {!locked ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            {open ? "Close" : "Edit Application"}
          </button>
        ) : null}
      </div>

      {locked ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          This application is locked because it has already been converted to a student file.
        </div>
      ) : null}

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

      {open && !locked ? (
        <div className="mt-5 space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <h4 className="font-semibold text-slate-900">Candidate</h4>

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
            <h4 className="font-semibold text-slate-900">Academic Request</h4>

            <div className="mt-3">
              <SectionSelectorClient
                schoolId={schoolId}
                sectionId={desiredSectionId}
                onSectionIdChange={setDesiredSectionId}
                label="Desired class / section"
                allowEmpty
              />
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900">Parent / Guardian</h4>

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
            onClick={saveApplication}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Application"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
