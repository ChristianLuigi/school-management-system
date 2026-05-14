"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionSelectorClient } from "@/components/section-selector-client";

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
};

export function StudentProfileEditClient({
  schoolId,
  studentId,
}: {
  schoolId: string;
  studentId: string;
}) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [previousSchoolName, setPreviousSchoolName] = useState("");
  const [previousSchoolAddress, setPreviousSchoolAddress] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [clearSection, setClearSection] = useState(false);

  const [photoReceived, setPhotoReceived] = useState(false);
  const [birthCertificateReceived, setBirthCertificateReceived] = useState(false);
  const [vaccinationCardReceived, setVaccinationCardReceived] = useState(false);
  const [previousSchoolRecordReceived, setPreviousSchoolRecordReceived] =
    useState(false);

  const [vaccinationStatus, setVaccinationStatus] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function hydrateForm(body: StudentProfile) {
    setProfile(body);

    setFirstName(body.student.firstName ?? "");
    setLastName(body.student.lastName ?? "");
    setStudentCode(body.student.studentCode ?? "");
    setGender(body.student.gender ?? "");
    setDateOfBirth(body.student.dateOfBirth ?? "");
    setPlaceOfBirth(body.student.placeOfBirth ?? "");
    setPhotoUrl(body.student.photoUrl ?? "");
    setPreviousSchoolName(body.student.previousSchoolName ?? "");
    setPreviousSchoolAddress(body.student.previousSchoolAddress ?? "");
    setSectionId(body.currentEnrollment.sectionId ?? "");
    setClearSection(false);

    setPhotoReceived(body.documents.photoReceived);
    setBirthCertificateReceived(body.documents.birthCertificateReceived);
    setVaccinationCardReceived(body.documents.vaccinationCardReceived);
    setPreviousSchoolRecordReceived(body.documents.previousSchoolRecordReceived);

    setVaccinationStatus(body.health.vaccinationStatus ?? "");
    setAllergies(body.health.allergies ?? "");
    setMedicalNotes(body.health.medicalNotes ?? "");
    setSpecialNeeds(body.health.specialNeeds ?? "");
  }

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

      hydrateForm(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load student profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error("First name and last name are required.");
      }

      const res = await fetch(`/api/school-students/${studentId}`, {
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
          sectionId: clearSection ? undefined : sectionId || undefined,
          clearSection,
          photoReceived,
          birthCertificateReceived,
          vaccinationCardReceived,
          previousSchoolRecordReceived,
          vaccinationStatus,
          allergies,
          medicalNotes,
          specialNeeds,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to save student profile.");
      }

      setMessage("Student profile updated successfully.");
      await loadProfile();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save student profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, studentId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/students/${studentId}`}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Back to Profile
        </Link>

        <button
          type="button"
          onClick={loadProfile}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Loading..." : "Reload"}
        </button>
      </div>

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!profile && loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading student profile...
        </div>
      ) : null}

      {profile ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Identity Information
            </h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="First name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />

              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />

              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Student code"
                value={studentCode}
                onChange={(event) => setStudentCode(event.target.value)}
              />

              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
              >
                <option value="">Gender</option>
                <option value="MALE">Boy / Garcon</option>
                <option value="FEMALE">Girl / Fille</option>
              </select>

              <input
                type="date"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
              />

              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Place of birth"
                value={placeOfBirth}
                onChange={(event) => setPlaceOfBirth(event.target.value)}
              />

              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                placeholder="Photo URL"
                value={photoUrl}
                onChange={(event) => setPhotoUrl(event.target.value)}
              />

              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                placeholder="Previous school name"
                value={previousSchoolName}
                onChange={(event) => setPreviousSchoolName(event.target.value)}
              />

              <textarea
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                placeholder="Previous school address"
                value={previousSchoolAddress}
                onChange={(event) =>
                  setPreviousSchoolAddress(event.target.value)
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Enrollment / Class
            </h3>

            <div className="mt-5 space-y-4">
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

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={clearSection}
                  onChange={(event) => setClearSection(event.target.checked)}
                />
                Remove current class assignment
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Document Checklist
            </h3>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={photoReceived}
                  onChange={(event) => setPhotoReceived(event.target.checked)}
                />
                Photo received
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={birthCertificateReceived}
                  onChange={(event) =>
                    setBirthCertificateReceived(event.target.checked)
                  }
                />
                Birth certificate received
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={vaccinationCardReceived}
                  onChange={(event) =>
                    setVaccinationCardReceived(event.target.checked)
                  }
                />
                Vaccination card received
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
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

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Health Information
            </h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
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

          <div className="sticky bottom-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                Save changes to update the student profile.
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={saveProfile}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Student Profile"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
