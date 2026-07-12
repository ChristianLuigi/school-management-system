"use client";

import { useMemo, useState } from "react";
import { AcademicQuickSetupClient } from "@/components/academic-quick-setup-client";
import { AcademicSubjectSetupClient } from "@/components/academic-subject-setup-client";
import { GradeLevelSectionsManagerClient } from "@/components/grade-level-sections-manager-client";

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
  gradeLevelDisplayOrder?: number;
  sectionDisplayOrder?: number;
  capacity?: number | null;
  roomLabel?: string | null;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
) {
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

function sortSections(items: SectionOption[]) {
  return [...items].sort(
    (a, b) =>
      (a.sectionDisplayOrder ?? 9999) - (b.sectionDisplayOrder ?? 9999) ||
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
  const [configureGradeLevelId, setConfigureGradeLevelId] = useState("");
  const [numberOfSections, setNumberOfSections] = useState("1");
  const [defaultCapacity, setDefaultCapacity] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStructure() {
    const [gradeLevelRes, optionsRes] = await Promise.all([
      fetch(`/api/proxy/academic/grade-levels?schoolId=${schoolId}`, {
        cache: "no-store",
      }),
      fetch(`/api/academic/section-options?schoolId=${schoolId}`, {
        cache: "no-store",
      }),
    ]);

    const gradeLevelBody = await gradeLevelRes.json().catch(() => null);
    const optionsBody: SectionOption[] | { message?: string } | null =
      await optionsRes.json().catch(() => null);

    if (!gradeLevelRes.ok) {
      throw new Error(
        gradeLevelBody?.message ?? "Failed to load academic structure.",
      );
    }

    if (!optionsRes.ok) {
      throw new Error(
        optionsBody && "message" in optionsBody
          ? optionsBody.message
          : "Failed to load sections.",
      );
    }

    setGradeLevels(Array.isArray(gradeLevelBody) ? gradeLevelBody : []);
    setSections(Array.isArray(optionsBody) ? optionsBody : []);
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

  async function configureSections(gradeLevelId: string) {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const count = Number(numberOfSections);
      const capacity = defaultCapacity.trim()
        ? Number(defaultCapacity)
        : undefined;

      if (!Number.isInteger(count) || count < 1) {
        throw new Error("Number of classrooms/sections must be at least 1.");
      }

      if (
        capacity !== undefined &&
        (!Number.isInteger(capacity) || capacity < 1)
      ) {
        throw new Error("Capacity must be a positive number.");
      }

      const res = await fetch(
        `/api/academic/grade-levels/${gradeLevelId}/sections/configure`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schoolId,
            numberOfSections: count,
            defaultCapacity: capacity,
          }),
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to configure sections.");
      }

      setMessage("Classrooms/sections configured successfully.");
      setConfigureGradeLevelId("");
      setNumberOfSections("1");
      setDefaultCapacity("");

      await loadStructure();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to configure sections.",
      );
    } finally {
      setSaving(false);
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

  function sectionsForGradeLevel(level: GradeLevel) {
    return sortSections(
      sections.filter((section) => section.gradeLevelCode === level.code),
    );
  }
  const sectionManagerLevels = useMemo(
    () =>
      sortGradeLevels(gradeLevels).map((level) => ({
        id: level.id,
        code: level.code,
        nameI18n: level.name_i18n,
        academicDivision: level.academic_division ?? null,
        sections: sectionsForGradeLevel(level).map((section) => ({
          id: section.id,
          code: section.code,
          nameI18n: section.nameI18n,
        })),
      })),
    [gradeLevels, sections],
  );

  return (
    <div className="space-y-6">
      <AcademicQuickSetupClient schoolId={schoolId} onApplied={loadStructure} />
      <GradeLevelSectionsManagerClient
        schoolId={schoolId}
        levels={sectionManagerLevels}
        onUpdated={loadStructure}
      />

      <AcademicSubjectSetupClient schoolId={schoolId} gradeLevels={gradeLevels} />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Advanced manual configuration
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Use these controls when you need to adjust generated classes,
            sections, or capacities by hand.
          </p>
        </div>

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

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Manual grade levels and sections</h2>
          <div className="mt-4 space-y-5">
            {["KINDERGARTEN", "PRIMARY", "SECONDARY", "OTHER"].map((key) =>
              groupedGradeLevels[key]?.length ? (
                <div key={key}>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    {divisionLabel(key === "OTHER" ? null : key)}
                  </div>

                  <div className="mt-2 grid gap-3">
                    {groupedGradeLevels[key].map((level) => {
                      const levelSections = sectionsForGradeLevel(level);

                      return (
                        <div
                          key={level.id}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="font-semibold text-slate-900">
                                {i18nName(level.name_i18n, level.code)}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {levelSections.length} section
                                {levelSections.length === 1 ? "" : "s"}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setConfigureGradeLevelId(
                                  configureGradeLevelId === level.id
                                    ? ""
                                    : level.id,
                                );
                                setNumberOfSections(
                                  String(Math.max(levelSections.length, 1)),
                                );
                                setDefaultCapacity("");
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                            >
                              {configureGradeLevelId === level.id
                                ? "Close"
                                : "Configure salles"}
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {levelSections.length ? (
                              levelSections.map((section) => (
                                <span
                                  key={section.id}
                                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                >
                                  {i18nName(section.nameI18n, section.code)}
                                  {section.capacity ? (
                                    <span className="ml-2 text-xs text-slate-500">
                                      Cap. {section.capacity}
                                    </span>
                                  ) : null}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-slate-500">
                                No sections configured yet.
                              </span>
                            )}
                          </div>

                          {configureGradeLevelId === level.id ? (
                            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                              <div className="font-semibold text-blue-900">
                                Configure salles / sections
                              </div>

                              <p className="mt-1 text-sm text-blue-800">
                                Enter how many parallel classrooms this level
                                should have. The system will generate Section A,
                                B, C, etc.
                              </p>

                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <input
                                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm"
                                  placeholder="Number of salles/classes"
                                  value={numberOfSections}
                                  onChange={(event) =>
                                    setNumberOfSections(event.target.value)
                                  }
                                />

                                <input
                                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm"
                                  placeholder="Capacity per section optional"
                                  value={defaultCapacity}
                                  onChange={(event) =>
                                    setDefaultCapacity(event.target.value)
                                  }
                                />
                              </div>

                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => configureSections(level.id)}
                                className="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                              >
                                {saving ? "Saving..." : "Generate sections"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
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
      </div>
    </div>
  );
}
