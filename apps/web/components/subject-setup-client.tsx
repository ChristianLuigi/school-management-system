"use client";

import { useEffect, useState } from "react";

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

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
) {
  return value?.fr ?? value?.en ?? fallback;
}

export function SubjectSetupClient({
  schoolId,
  gradeLevels,
}: {
  schoolId: string;
  gradeLevels: GradeLevel[];
}) {
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [code, setCode] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [coefficient, setCoefficient] = useState("1");
  const [displayOrder, setDisplayOrder] = useState("100");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSubjects() {
    setError("");

    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subjects.");
    }
  }

  async function createSubject() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
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
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create subject.");
      }

      setMessage("Subject saved.");
      setCode("");
      setNameFr("");
      setNameEn("");
      await loadSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subject.");
    } finally {
      setSaving(false);
    }
  }

  async function assignSubject() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!gradeLevelId || !subjectId) {
        throw new Error("Select a grade level and subject.");
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
            coefficient: Number(coefficient),
            displayOrder: Number(displayOrder),
            isRequired: true,
          }),
        },
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to assign subject.");
      }

      setMessage("Subject assigned to grade level.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign subject.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => {
    setGradeLevelId((current) => current || gradeLevels[0]?.id || "");
  }, [gradeLevels]);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold">Subject Setup</h2>
      <p className="mt-1 text-sm text-slate-600">
        Create school subjects and assign them to grade levels with coefficients.
      </p>

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

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-900">Create subject</h3>

          <div className="mt-4 grid gap-3">
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Code, example: MATH"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="French name"
              value={nameFr}
              onChange={(event) => setNameFr(event.target.value)}
            />
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="English name optional"
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
            />
            <button
              type="button"
              onClick={createSubject}
              disabled={saving}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Save subject
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-900">
            Assign to grade level
          </h3>

          <div className="mt-4 grid gap-3">
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
            <button
              type="button"
              onClick={assignSubject}
              disabled={saving}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              Assign subject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
