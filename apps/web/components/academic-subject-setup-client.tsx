"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { SchoolBadge } from "@/components/school-ui";
import type { Locale } from "@/lib/i18n/messages";

type GradeLevel = {
  id: string;
  code: string;
  name_i18n: Record<string, string> | null;
};

type SchoolSubject = {
  id: string;
  code: string;
  nameI18n: Record<string, string> | null;
  description: string | null;
  subjectActive: boolean;
};

type GradeLevelSubject = {
  id: string;
  subjectId: string;
  code: string;
  nameI18n: Record<string, string> | null;
  coefficient: number;
  displayOrder: number;
  isRequired: boolean;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
  locale: Locale,
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? fallback;
}

export function AcademicSubjectSetupClient({
  schoolId,
  gradeLevels,
}: {
  schoolId: string;
  gradeLevels: GradeLevel[];
}) {
  const { locale, t } = useI18n();
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<
    GradeLevelSubject[]
  >([]);

  const [code, setCode] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [description, setDescription] = useState("");

  const [gradeLevelId, setGradeLevelId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [coefficient, setCoefficient] = useState("1");
  const [displayOrder, setDisplayOrder] = useState("100");
  const [isRequired, setIsRequired] = useState(true);

  const [loading, setLoading] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSubjects() {
    const params = new URLSearchParams({ schoolId });

    const res = await fetch(`/api/academic/subjects?${params.toString()}`, {
      cache: "no-store",
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(body?.message ?? "Failed to load subjects.");
    }

    setSubjects(body);
    setSubjectId((current) => current || body[0]?.id || "");
  }

  async function loadAssignedSubjects(levelId = gradeLevelId) {
    if (!levelId) {
      setAssignedSubjects([]);
      return;
    }

    const params = new URLSearchParams({ schoolId });

    const res = await fetch(
      `/api/academic/grade-levels/${levelId}/subjects?${params.toString()}`,
      { cache: "no-store" },
    );

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(body?.message ?? "Failed to load assigned subjects.");
    }

    setAssignedSubjects(body);
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      await loadSubjects();
      await loadAssignedSubjects();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load subject setup.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createSubject() {
    setSavingSubject(true);
    setMessage("");
    setError("");

    try {
      if (!code.trim() || !nameFr.trim()) {
        throw new Error("Subject code and French name are required.");
      }

      const res = await fetch("/api/academic/subjects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          code,
          nameFr,
          nameEn: nameEn || undefined,
          description: description || undefined,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create subject.");
      }

      setMessage(t("academic.subjectSaved"));
      setCode("");
      setNameFr("");
      setNameEn("");
      setDescription("");

      await loadSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subject.");
    } finally {
      setSavingSubject(false);
    }
  }

  async function assignSubject() {
    setAssigning(true);
    setMessage("");
    setError("");

    try {
      if (!gradeLevelId || !subjectId) {
        throw new Error("Please select a grade level and a subject.");
      }

      const coef = Number(coefficient);
      const order = Number(displayOrder);

      if (!Number.isFinite(coef) || coef < 0) {
        throw new Error("Coefficient must be valid.");
      }

      if (!Number.isInteger(order) || order < 1) {
        throw new Error("Display order must be a positive integer.");
      }

      const res = await fetch(
        `/api/academic/grade-levels/${gradeLevelId}/subjects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schoolId,
            subjectId,
            coefficient: coef,
            displayOrder: order,
            isRequired,
          }),
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to assign subject.");
      }

      setMessage(t("academic.subjectAssigned"));
      setSubjectId("");
      setCoefficient("1");
      setDisplayOrder("100");
      setIsRequired(true);

      await loadAssignedSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign subject.");
    } finally {
      setAssigning(false);
    }
  }

  useEffect(() => {
    setGradeLevelId((current) => current || gradeLevels[0]?.id || "");
  }, [gradeLevels]);

  useEffect(() => {
    loadSubjects().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load subjects.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => {
    loadAssignedSubjects().catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load assigned subjects.",
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeLevelId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t("academic.subjectSetup")}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {t("academic.subjectSetupDescription")}
          </p>
        </div>

        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? t("common.loading") : t("common.refresh")}
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

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="font-semibold text-slate-900">
            {t("academic.createSubject")}
          </h4>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder={t("academic.subjectCodePlaceholder")}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder={t("academic.frenchName")}
              value={nameFr}
              onChange={(event) => setNameFr(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder={t("academic.englishNameOptional")}
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
            />

            <textarea
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder={t("academic.descriptionOptional")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <button
            type="button"
            disabled={savingSubject}
            onClick={createSubject}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {savingSubject ? t("common.saving") : t("academic.saveSubject")}
          </button>

          <div className="mt-5 space-y-2">
            {subjects.map((subject) => (
              <div
                key={subject.id}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">
                      {i18nName(subject.nameI18n, subject.code, locale)}
                    </div>
                    <div className="text-xs text-slate-500">{subject.code}</div>
                  </div>

                  <SchoolBadge tone={subject.subjectActive ? "green" : "red"}>
                    {subject.subjectActive
                      ? t("common.active")
                      : t("common.inactive")}
                  </SchoolBadge>
                </div>
              </div>
            ))}

            {subjects.length === 0 ? (
              <div className="rounded-xl bg-white p-3 text-sm text-slate-500">
                {t("academic.noSubjectsYet")}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="font-semibold text-slate-900">
            {t("academic.assignSubjectToClass")}
          </h4>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              value={gradeLevelId}
              onChange={(event) => setGradeLevelId(event.target.value)}
            >
              <option value="">{t("academic.selectGradeLevel")}</option>
              {gradeLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {i18nName(level.name_i18n, level.code, locale)}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              <option value="">{t("academic.selectSubject")}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {i18nName(subject.nameI18n, subject.code, locale)}
                </option>
              ))}
            </select>

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder={t("academic.coefficient")}
              value={coefficient}
              onChange={(event) => setCoefficient(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder={t("academic.displayOrder")}
              value={displayOrder}
              onChange={(event) => setDisplayOrder(event.target.value)}
            />
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(event) => setIsRequired(event.target.checked)}
            />
            {t("academic.requiredSubject")}
          </label>

          <button
            type="button"
            disabled={assigning}
            onClick={assignSubject}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {assigning ? t("academic.assigning") : t("academic.assignSubject")}
          </button>

          <div className="mt-5 space-y-2">
            {assignedSubjects.map((subject) => (
              <div
                key={subject.id}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">
                      {i18nName(subject.nameI18n, subject.code, locale)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {subject.code} - {t("academic.order")} {subject.displayOrder}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <SchoolBadge tone="blue">
                      {t("academic.coefficient")} {subject.coefficient}
                    </SchoolBadge>

                    <SchoolBadge tone={subject.isRequired ? "green" : "amber"}>
                      {subject.isRequired
                        ? t("common.required")
                        : t("common.optional")}
                    </SchoolBadge>
                  </div>
                </div>
              </div>
            ))}

            {assignedSubjects.length === 0 ? (
              <div className="rounded-xl bg-white p-3 text-sm text-slate-500">
                {t("academic.noAssignedSubjects")}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}