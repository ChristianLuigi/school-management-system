"use client";

import { useState } from "react";

type GradeLevel = {
  id: string;
  code: string;
  name_i18n: Record<string, string> | null;
  academic_division?: "KINDERGARTEN" | "PRIMARY" | "SECONDARY" | null;
  display_order?: number | null;
};

type SectionOption = {
  id: string;
  code: string;
  nameI18n: Record<string, string> | null;
  gradeLevelCode: string | null;
  gradeLevelNameI18n: Record<string, string> | null;
  academicDivision: "KINDERGARTEN" | "PRIMARY" | "SECONDARY" | null;
};

type AcademicOptions = {
  sections: SectionOption[];
  message?: string;
};

function i18nName(value: Record<string, string> | null | undefined, fallback: string) {
  return value?.fr ?? value?.en ?? fallback;
}

function divisionLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    KINDERGARTEN: "Maternelle",
    PRIMARY: "Primaire",
    SECONDARY: "Secondaire",
  };

  return value ? labels[value] ?? value : "Other";
}

function sortGradeLevels(items: GradeLevel[]) {
  return [...items].sort(
    (a, b) =>
      (a.display_order ?? 9999) - (b.display_order ?? 9999) ||
      a.code.localeCompare(b.code),
  );
}

export function AcademicStructureClient({
  schoolId,
  initialGradeLevels,
  initialSections,
}: {
  schoolId: string;
  initialGradeLevels: GradeLevel[];
  initialSections: SectionOption[];
}) {
  const [gradeLevels, setGradeLevels] = useState(initialGradeLevels);
  const [sections, setSections] = useState(initialSections);
  const [includeKindergarten, setIncludeKindergarten] = useState(true);
  const [includePrimary, setIncludePrimary] = useState(true);
  const [includeSecondary, setIncludeSecondary] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStructure() {
    const [gradeLevelRes, optionsRes] = await Promise.all([
      fetch(`/api/proxy/academic/grade-levels?schoolId=${schoolId}`, {
        cache: "no-store",
      }),
      fetch(`/api/report-cards/options?schoolId=${schoolId}`, {
        cache: "no-store",
      }),
    ]);

    const gradeLevelBody = await gradeLevelRes.json().catch(() => null);
    const optionsBody: AcademicOptions | null = await optionsRes
      .json()
      .catch(() => null);

    if (!gradeLevelRes.ok) {
      throw new Error(
        gradeLevelBody?.message ?? "Failed to load academic structure.",
      );
    }

    if (!optionsRes.ok) {
      throw new Error(optionsBody?.message ?? "Failed to load sections.");
    }

    setGradeLevels(Array.isArray(gradeLevelBody) ? gradeLevelBody : []);
    setSections(optionsBody?.sections ?? []);
  }

  async function createSelectedStructure() {
    setSeeding(true);
    setMessage("");
    setError("");

    try {
      if (!includeKindergarten && !includePrimary && !includeSecondary) {
        throw new Error("Select at least one academic division.");
      }

      const res = await fetch("/api/academic/haitian-structure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          includeKindergarten,
          includePrimary,
          includeSecondary,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create academic structure.");
      }

      setMessage("Selected academic structure created or updated.");
      await loadStructure();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create academic structure.",
      );
    } finally {
      setSeeding(false);
    }
  }

  const groupedGradeLevels = sortGradeLevels(gradeLevels).reduce<
    Record<string, GradeLevel[]>
  >((groups, gradeLevel) => {
    const key = gradeLevel.academic_division ?? "OTHER";
    groups[key] = groups[key] ?? [];
    groups[key].push(gradeLevel);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="font-semibold text-slate-900">
          Configure academic divisions
        </div>

        <p className="mt-1 text-sm text-slate-600">
          Select only the levels offered by this school.
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeKindergarten}
              onChange={(event) => setIncludeKindergarten(event.target.checked)}
            />
            Maternelle
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includePrimary}
              onChange={(event) => setIncludePrimary(event.target.checked)}
            />
            Primaire
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeSecondary}
              onChange={(event) => setIncludeSecondary(event.target.checked)}
            />
            Secondaire
          </label>
        </div>

        <button
          type="button"
          onClick={createSelectedStructure}
          disabled={seeding}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {seeding ? "Creating..." : "Create selected structure"}
        </button>

        {message ? (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Grade levels</h2>
          <div className="mt-4 space-y-4">
            {["KINDERGARTEN", "PRIMARY", "SECONDARY", "OTHER"].map((key) =>
              groupedGradeLevels[key]?.length ? (
                <div key={key}>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    {divisionLabel(key === "OTHER" ? null : key)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groupedGradeLevels[key].map((gradeLevel) => (
                      <span
                        key={gradeLevel.id}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        {i18nName(gradeLevel.name_i18n, gradeLevel.code)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null,
            )}

            {gradeLevels.length === 0 ? (
              <div className="text-sm text-slate-500">
                Academic structure not configured yet.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Sections</h2>
          <div className="mt-4 space-y-2">
            {sections.map((section) => (
              <div
                key={section.id}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <div className="font-medium">
                  {i18nName(section.nameI18n, section.code)}
                </div>
                <div className="text-xs text-slate-500">
                  {divisionLabel(section.academicDivision)}
                </div>
              </div>
            ))}

            {sections.length === 0 ? (
              <div className="text-sm text-slate-500">
                Academic structure not configured yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
