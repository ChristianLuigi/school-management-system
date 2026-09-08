"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  Loader2,
  UserRound,
} from "lucide-react";
import { SectionSelectorClient } from "@/components/section-selector-client";
import { useI18n } from "@/components/i18n-provider";

const STEPS = [
  { id: 1, labelKey: "students.create.studentStep", icon: UserRound },
  { id: 2, labelKey: "students.create.placementStep", icon: GraduationCap },
  { id: 3, labelKey: "students.create.reviewStep", icon: FileCheck2 },
] as const;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
    </span>
  );
}

export function StudentCreateClient({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [previousSchoolName, setPreviousSchoolName] = useState("");
  const [previousSchoolAddress, setPreviousSchoolAddress] = useState("");
  const [photoReceived, setPhotoReceived] = useState(false);
  const [birthCertificateReceived, setBirthCertificateReceived] =
    useState(false);
  const [vaccinationCardReceived, setVaccinationCardReceived] = useState(false);
  const [previousSchoolRecordReceived, setPreviousSchoolRecordReceived] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  function validateIdentity() {
    if (!firstName.trim() || !lastName.trim()) {
      setError(t("students.create.requiredNames"));
      return false;
    }
    if (firstName.trim().length > 120 || lastName.trim().length > 120) {
      setError(t("students.create.namesTooLong"));
      return false;
    }
    if (dateOfBirth && dateOfBirth > today) {
      setError(t("students.create.futureBirthDate"));
      return false;
    }
    setError("");
    return true;
  }

  function nextStep() {
    if (step === 1 && !validateIdentity()) return;
    setError("");
    setStep((current) => Math.min(3, current + 1));
  }

  async function createStudent() {
    if (!validateIdentity()) {
      setStep(1);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/school-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender: gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          placeOfBirth: placeOfBirth.trim() || undefined,
          studentCode: studentCode.trim() || undefined,
          sectionId: sectionId || undefined,
          previousSchoolName: previousSchoolName.trim() || undefined,
          previousSchoolAddress: previousSchoolAddress.trim() || undefined,
          photoReceived,
          birthCertificateReceived,
          vaccinationCardReceived,
          previousSchoolRecordReceived,
        }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message ?? t("students.create.failed"));
      }

      router.push(`/students/${body.id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("students.create.failed"),
      );
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) {
      nextStep();
      return;
    }
    void createStudent();
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map((item) => {
            const Icon = item.icon;
            const active = item.id === step;
            const complete = item.id < step;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.id === 1 || validateIdentity()) setStep(item.id);
                  }}
                  aria-current={active ? "step" : undefined}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-slate-950 text-white"
                      : complete
                        ? "bg-green-50 text-green-700"
                        : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {complete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{t(item.labelKey)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {step === 1 ? (
          <div>
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-blue-700" />
              <h2 className="font-semibold text-slate-950">
                {t("students.create.identityTitle")}
              </h2>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <FieldLabel>{t("students.firstName")} *</FieldLabel>
                <input
                  required
                  autoFocus
                  maxLength={120}
                  autoComplete="off"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label>
                <FieldLabel>{t("students.lastName")} *</FieldLabel>
                <input
                  required
                  maxLength={120}
                  autoComplete="off"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label>
                <FieldLabel>{t("students.create.gender")}</FieldLabel>
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">{t("students.create.notSpecified")}</option>
                  <option value="MALE">{t("students.create.boy")}</option>
                  <option value="FEMALE">{t("students.create.girl")}</option>
                </select>
              </label>
              <label>
                <FieldLabel>{t("students.create.dateOfBirth")}</FieldLabel>
                <input
                  type="date"
                  max={today}
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="sm:col-span-2">
                <FieldLabel>{t("students.create.placeOfBirth")}</FieldLabel>
                <input
                  maxLength={200}
                  value={placeOfBirth}
                  onChange={(event) => setPlaceOfBirth(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-700" />
              <h2 className="font-semibold text-slate-950">
                {t("students.create.placementStep")}
              </h2>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <FieldLabel>{t("students.studentCode")}</FieldLabel>
                <input
                  maxLength={50}
                  placeholder={t("students.create.generatedIfBlank")}
                  value={studentCode}
                  onChange={(event) => setStudentCode(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
              <div>
                <SectionSelectorClient
                  schoolId={schoolId}
                  sectionId={sectionId}
                  onSectionIdChange={setSectionId}
                  label={t("students.classSection")}
                  allowEmpty
                  emptyLabel={t("students.create.assignLater")}
                />
              </div>
              <label className="sm:col-span-2">
                <FieldLabel>{t("students.create.previousSchool")}</FieldLabel>
                <input
                  maxLength={200}
                  value={previousSchoolName}
                  onChange={(event) =>
                    setPreviousSchoolName(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="sm:col-span-2">
                <FieldLabel>
                  {t("students.create.previousSchoolAddress")}
                </FieldLabel>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={previousSchoolAddress}
                  onChange={(event) =>
                    setPreviousSchoolAddress(event.target.value)
                  }
                  className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-blue-700" />
              <h2 className="font-semibold text-slate-950">
                {t("students.create.reviewTitle")}
              </h2>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("students.student")}
                </div>
                <div className="mt-2 font-semibold text-slate-950">
                  {firstName.trim()} {lastName.trim()}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {studentCode.trim() || t("students.create.generatedCode")}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("students.create.accessState")}
                </div>
                <div className="mt-2 font-semibold text-slate-950">
                  {sectionId
                    ? t("students.create.activeWithClass")
                    : t("students.create.registeredClassPending")}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 text-sm font-medium text-slate-700">
                {t("students.create.documentsReceived")}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  [
                    t("students.create.photo"),
                    photoReceived,
                    setPhotoReceived,
                  ],
                  [
                    t("students.create.birthCertificate"),
                    birthCertificateReceived,
                    setBirthCertificateReceived,
                  ],
                  [
                    t("students.create.vaccinationCard"),
                    vaccinationCardReceived,
                    setVaccinationCardReceived,
                  ],
                  [
                    t("students.create.previousSchoolRecord"),
                    previousSchoolRecordReceived,
                    setPreviousSchoolRecordReceived,
                  ],
                ].map(([label, checked, setter]) => (
                  <label
                    key={String(label)}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checked)}
                      onChange={(event) =>
                        (setter as (value: boolean) => void)(
                          event.target.checked,
                        )
                      }
                    />
                    {String(label)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          {step === 1 ? (
            <Link
              href="/students"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("common.cancel")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("common.back")}
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : step === 3 ? (
            <Check className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {saving
            ? t("students.create.creating")
            : step === 3
              ? t("students.create.createStudent")
              : t("students.create.continue")}
        </button>
      </div>
    </form>
  );
}
