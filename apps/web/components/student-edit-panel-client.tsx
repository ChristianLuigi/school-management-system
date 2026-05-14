"use client";

import { useEffect, useState } from "react";
import { SectionSelectorClient } from "@/components/section-selector-client";

type StudentProfileForEdit = {
  student: {
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    placeOfBirth?: string | null;
    photoUrl?: string | null;
    previousSchoolName?: string | null;
    previousSchoolAddress?: string | null;
  };
  currentEnrollment: {
    sectionId: string | null;
  };
  documents?: {
    photoReceived: boolean;
    birthCertificateReceived: boolean;
    vaccinationCardReceived: boolean;
    previousSchoolRecordReceived: boolean;
  };
  health?: {
    vaccinationStatus: string | null;
    allergies: string | null;
    medicalNotes: string | null;
    specialNeeds: string | null;
  };
};

export function StudentEditPanelClient({
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
  const [studentCode, setStudentCode] = useState(
    profile.student.studentCode ?? "",
  );
  const [gender, setGender] = useState(profile.student.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(
    profile.student.dateOfBirth ?? "",
  );
  const [placeOfBirth, setPlaceOfBirth] = useState(
    profile.student.placeOfBirth ?? "",
  );
  const [photoUrl, setPhotoUrl] = useState(profile.student.photoUrl ?? "");
  const [previousSchoolName, setPreviousSchoolName] = useState(
    profile.student.previousSchoolName ?? "",
  );
  const [previousSchoolAddress, setPreviousSchoolAddress] = useState(
    profile.student.previousSchoolAddress ?? "",
  );
  const [photoReceived, setPhotoReceived] = useState(
    profile.documents?.photoReceived ?? false,
  );
  const [birthCertificateReceived, setBirthCertificateReceived] = useState(
    profile.documents?.birthCertificateReceived ?? false,
  );
  const [vaccinationCardReceived, setVaccinationCardReceived] = useState(
    profile.documents?.vaccinationCardReceived ?? false,
  );
  const [previousSchoolRecordReceived, setPreviousSchoolRecordReceived] =
    useState(profile.documents?.previousSchoolRecordReceived ?? false);
  const [vaccinationStatus, setVaccinationStatus] = useState(
    profile.health?.vaccinationStatus ?? "",
  );
  const [allergies, setAllergies] = useState(
    profile.health?.allergies ?? "",
  );
  const [medicalNotes, setMedicalNotes] = useState(
    profile.health?.medicalNotes ?? "",
  );
  const [specialNeeds, setSpecialNeeds] = useState(
    profile.health?.specialNeeds ?? "",
  );
  const [sectionId, setSectionId] = useState(
    profile.currentEnrollment.sectionId ?? "",
  );
  const [clearSection, setClearSection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFirstName(profile.student.firstName ?? "");
    setLastName(profile.student.lastName ?? "");
    setStudentCode(profile.student.studentCode ?? "");
    setGender(profile.student.gender ?? "");
    setDateOfBirth(profile.student.dateOfBirth ?? "");
    setPlaceOfBirth(profile.student.placeOfBirth ?? "");
    setPhotoUrl(profile.student.photoUrl ?? "");
    setPreviousSchoolName(profile.student.previousSchoolName ?? "");
    setPreviousSchoolAddress(profile.student.previousSchoolAddress ?? "");
    setPhotoReceived(profile.documents?.photoReceived ?? false);
    setBirthCertificateReceived(
      profile.documents?.birthCertificateReceived ?? false,
    );
    setVaccinationCardReceived(
      profile.documents?.vaccinationCardReceived ?? false,
    );
    setPreviousSchoolRecordReceived(
      profile.documents?.previousSchoolRecordReceived ?? false,
    );
    setVaccinationStatus(profile.health?.vaccinationStatus ?? "");
    setAllergies(profile.health?.allergies ?? "");
    setMedicalNotes(profile.health?.medicalNotes ?? "");
    setSpecialNeeds(profile.health?.specialNeeds ?? "");
    setSectionId(profile.currentEnrollment.sectionId ?? "");
    setClearSection(false);
  }, [profile]);

  async function saveStudent() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error("First name and last name are required.");
      }

      const res = await fetch(`/api/school-students/${profile.student.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          firstName,
          lastName,
          studentCode,
          gender: gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          placeOfBirth,
          photoUrl,
          previousSchoolName,
          previousSchoolAddress,
          photoReceived,
          birthCertificateReceived,
          vaccinationCardReceived,
          previousSchoolRecordReceived,
          vaccinationStatus,
          allergies,
          medicalNotes,
          specialNeeds,
          sectionId: clearSection ? undefined : sectionId || undefined,
          clearSection,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to update student.");
      }

      setMessage("Student updated successfully.");
      setOpen(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update student.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Student Information
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Edit identity information and current section.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          {open ? "Close" : "Edit Student"}
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
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 md:grid-cols-2">
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

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="Student code"
              value={studentCode}
              onChange={(event) => setStudentCode(event.target.value)}
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
              placeholder="Photo URL"
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
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
              onChange={(event) => setPreviousSchoolAddress(event.target.value)}
            />

            <div className="md:col-span-2">
              <SectionSelectorClient
                schoolId={schoolId}
                sectionId={sectionId}
                onSectionIdChange={(value) => {
                  setSectionId(value);
                  setClearSection(false);
                }}
                label="Current section"
                allowEmpty
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
              <div className="font-semibold text-slate-900">
                Document Checklist
              </div>

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

            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
              <div className="font-semibold text-slate-900">
                Health Information
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Vaccination status"
                  value={vaccinationStatus}
                  onChange={(event) => setVaccinationStatus(event.target.value)}
                />

                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Allergies"
                  value={allergies}
                  onChange={(event) => setAllergies(event.target.value)}
                />

                <textarea
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                  placeholder="Medical notes"
                  value={medicalNotes}
                  onChange={(event) => setMedicalNotes(event.target.value)}
                />

                <textarea
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                  placeholder="Special needs"
                  value={specialNeeds}
                  onChange={(event) => setSpecialNeeds(event.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={clearSection}
                onChange={(event) => setClearSection(event.target.checked)}
              />
              Remove current class assignment
            </label>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={saveStudent}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
