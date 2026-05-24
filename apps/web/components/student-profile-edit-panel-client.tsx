"use client";

import { useEffect, useState } from "react";

type StudentProfileForEdit = {
  student: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    previousSchoolName: string | null;
    previousSchoolAddress: string | null;
    photoReceived: boolean;
    birthCertificateReceived: boolean;
    vaccinationCardReceived: boolean;
    previousSchoolRecordReceived: boolean;
    healthNotes: string | null;
    allergyNotes: string | null;
    medicalNotes: string | null;
  };
};

export function StudentProfileEditPanelClient({
  schoolId,
  profile,
  onUpdated,
}: {
  schoolId: string;
  profile: StudentProfileForEdit;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(profile.student.firstName ?? "");
  const [lastName, setLastName] = useState(profile.student.lastName ?? "");
  const [gender, setGender] = useState(profile.student.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(
    profile.student.dateOfBirth ?? "",
  );
  const [placeOfBirth, setPlaceOfBirth] = useState(
    profile.student.placeOfBirth ?? "",
  );
  const [previousSchoolName, setPreviousSchoolName] = useState(
    profile.student.previousSchoolName ?? "",
  );
  const [previousSchoolAddress, setPreviousSchoolAddress] = useState(
    profile.student.previousSchoolAddress ?? "",
  );
  const [photoReceived, setPhotoReceived] = useState(
    profile.student.photoReceived,
  );
  const [birthCertificateReceived, setBirthCertificateReceived] = useState(
    profile.student.birthCertificateReceived,
  );
  const [vaccinationCardReceived, setVaccinationCardReceived] = useState(
    profile.student.vaccinationCardReceived,
  );
  const [previousSchoolRecordReceived, setPreviousSchoolRecordReceived] =
    useState(profile.student.previousSchoolRecordReceived);
  const [healthNotes, setHealthNotes] = useState(
    profile.student.healthNotes ?? "",
  );
  const [allergyNotes, setAllergyNotes] = useState(
    profile.student.allergyNotes ?? "",
  );
  const [medicalNotes, setMedicalNotes] = useState(
    profile.student.medicalNotes ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFirstName(profile.student.firstName ?? "");
    setLastName(profile.student.lastName ?? "");
    setGender(profile.student.gender ?? "");
    setDateOfBirth(profile.student.dateOfBirth ?? "");
    setPlaceOfBirth(profile.student.placeOfBirth ?? "");
    setPreviousSchoolName(profile.student.previousSchoolName ?? "");
    setPreviousSchoolAddress(profile.student.previousSchoolAddress ?? "");
    setPhotoReceived(profile.student.photoReceived);
    setBirthCertificateReceived(profile.student.birthCertificateReceived);
    setVaccinationCardReceived(profile.student.vaccinationCardReceived);
    setPreviousSchoolRecordReceived(
      profile.student.previousSchoolRecordReceived,
    );
    setHealthNotes(profile.student.healthNotes ?? "");
    setAllergyNotes(profile.student.allergyNotes ?? "");
    setMedicalNotes(profile.student.medicalNotes ?? "");
  }, [profile]);

  async function saveProfile() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error("First name and last name are required.");
      }

      const res = await fetch(
        `/api/school-students/${profile.student.id}/profile`,
        {
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
            photoReceived,
            birthCertificateReceived,
            vaccinationCardReceived,
            previousSchoolRecordReceived,
            healthNotes,
            allergyNotes,
            medicalNotes,
          }),
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to update student profile.");
      }

      setMessage("Student profile updated successfully.");
      setOpen(false);
      onUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update student profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Student File
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Update identity, documents, and medical notes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          {open ? "Close" : "Edit Student File"}
        </button>
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

      {open ? (
        <div className="mt-5 space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <h4 className="font-semibold text-slate-900">Identity</h4>

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
                <option value="MALE">Garcon</option>
                <option value="FEMALE">Fille</option>
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
                placeholder="Previous school"
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
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900">Health</h4>

            <div className="mt-3 grid gap-4">
              <textarea
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Health notes"
                value={healthNotes}
                onChange={(event) => setHealthNotes(event.target.value)}
              />

              <textarea
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Allergy notes"
                value={allergyNotes}
                onChange={(event) => setAllergyNotes(event.target.value)}
              />

              <textarea
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Medical notes"
                value={medicalNotes}
                onChange={(event) => setMedicalNotes(event.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={saveProfile}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Student File"}
          </button>
        </div>
      ) : null}
    </div>
  );
}