"use client";

import { useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

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
) {
  return value?.fr ?? value?.en ?? fallback;
}

export function AcademicSubjectSetupClient({
  schoolId,
  gradeLevels,
}: {
  schoolId: string;
  gradeLevels: GradeLevel[];
}) {
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

      setMessage("Subject saved successfully.");
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

      setMessage("Subject assigned successfully.");
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
            Subject Setup
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Create school subjects and assign them to each class/grade level.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
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
          <h4 className="font-semibold text-slate-900">Create Subject</h4>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Code, example: MATH"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Nom francais"
              value={nameFr}
              onChange={(event) => setNameFr(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="English name optional"
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
            />

            <textarea
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="Description optional"
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
            {savingSubject ? "Saving..." : "Save Subject"}
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
                      {i18nName(subject.nameI18n, subject.code)}
                    </div>
                    <div className="text-xs text-slate-500">{subject.code}</div>
                  </div>

                  <SchoolBadge tone={subject.subjectActive ? "green" : "red"}>
                    {subject.subjectActive ? "Active" : "Inactive"}
                  </SchoolBadge>
                </div>
              </div>
            ))}

            {subjects.length === 0 ? (
              <div className="rounded-xl bg-white p-3 text-sm text-slate-500">
                No subjects created yet.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="font-semibold text-slate-900">
            Assign Subject to Class / Grade Level
          </h4>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              value={gradeLevelId}
              onChange={(event) => setGradeLevelId(event.target.value)}
            >
              <option value="">Select grade level</option>
              {gradeLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {i18nName(level.name_i18n, level.code)}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {i18nName(subject.nameI18n, subject.code)}
                </option>
              ))}
            </select>

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Coefficient"
              value={coefficient}
              onChange={(event) => setCoefficient(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Display order"
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
            Required subject
          </label>

          <button
            type="button"
            disabled={assigning}
            onClick={assignSubject}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {assigning ? "Assigning..." : "Assign Subject"}
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
                      {i18nName(subject.nameI18n, subject.code)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {subject.code} - Order {subject.displayOrder}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <SchoolBadge tone="blue">
                      Coef {subject.coefficient}
                    </SchoolBadge>

                    <SchoolBadge tone={subject.isRequired ? "green" : "amber"}>
                      {subject.isRequired ? "Required" : "Optional"}
                    </SchoolBadge>
                  </div>
                </div>
              </div>
            ))}

            {assignedSubjects.length === 0 ? (
              <div className="rounded-xl bg-white p-3 text-sm text-slate-500">
                No subjects assigned to this grade level yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
