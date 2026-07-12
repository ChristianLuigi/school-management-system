"use client";

import { useEffect, useMemo, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type AcademicStructureSection = {
  id: string;
  code: string;
  nameI18n: Record<string, string> | null;
};

type AcademicStructureLevel = {
  id: string;
  code: string;
  nameI18n: Record<string, string> | null;
  academicDivision: "KINDERGARTEN" | "PRIMARY" | "SECONDARY" | string | null;
  sections: AcademicStructureSection[];
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
) {
  return value?.fr ?? value?.en ?? fallback;
}

function divisionLabel(value: string | null) {
  if (value === "KINDERGARTEN") return "Maternelle";
  if (value === "PRIMARY") return "Primaire / Fondamental";
  if (value === "SECONDARY") return "Secondaire";
  return "Autres";
}

function divisionTone(value: string | null): BadgeTone {
  if (value === "KINDERGARTEN") return "amber";
  if (value === "PRIMARY") return "blue";
  if (value === "SECONDARY") return "green";
  return "neutral";
}

function sectionLetter(section: AcademicStructureSection) {
  const parts = section.code.split("-");
  return parts[parts.length - 1] || section.code;
}

const DIVISION_ORDER = ["KINDERGARTEN", "PRIMARY", "SECONDARY", "OTHER"];

export function GradeLevelSectionsManagerClient({
  schoolId,
  levels,
  onUpdated,
}: {
  schoolId: string;
  levels: AcademicStructureLevel[];
  onUpdated: () => Promise<void> | void;
}) {
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSectionCounts(
      Object.fromEntries(
        levels.map((level) => [level.id, level.sections?.length ?? 0]),
      ),
    );
  }, [levels]);

  const grouped = useMemo(() => {
    const result: Record<string, AcademicStructureLevel[]> = {};

    for (const level of levels) {
      const key = level.academicDivision ?? "OTHER";
      result[key] = result[key] ?? [];
      result[key].push(level);
    }

    return result;
  }, [levels]);

  function updateCount(levelId: string, value: number) {
    const nextValue = Number.isFinite(value) ? Math.max(0, Math.min(20, value)) : 0;

    setSectionCounts((current) => ({
      ...current,
      [levelId]: nextValue,
    }));
  }

  async function saveLevel(level: AcademicStructureLevel) {
    setSavingId(level.id);
    setMessage("");
    setError("");

    try {
      const sectionCount = sectionCounts[level.id] ?? 0;

      const res = await fetch(
        `/api/academic/grade-levels/${level.id}/sections/configure`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schoolId,
            sectionCount,
          }),
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to configure sections.");
      }

      if (Array.isArray(body.blocked) && body.blocked.length > 0) {
        setMessage(
          `Saved, but ${body.blocked.length} section(s) could not be archived because they still have active students.`,
        );
      } else {
        setMessage(`${i18nName(level.nameI18n, level.code)} sections updated.`);
      }

      await onUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to configure sections.",
      );
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Classes et sections
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Ajustez le nombre de sections ou salles pour chaque classe.
        </p>
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

      <div className="mt-5 space-y-5">
        {DIVISION_ORDER.map((division) => {
          const divisionLevels = grouped[division] ?? [];

          if (divisionLevels.length === 0) {
            return null;
          }

          return (
            <div
              key={division}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">
                  {divisionLabel(division === "OTHER" ? null : division)}
                </h3>

                <SchoolBadge tone={divisionTone(division)}>
                  {divisionLevels.length} classe(s)
                </SchoolBadge>
              </div>

              <div className="mt-4 space-y-3">
                {divisionLevels.map((level) => {
                  const count =
                    sectionCounts[level.id] ?? level.sections?.length ?? 0;

                  return (
                    <div
                      key={level.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="grid gap-4 lg:grid-cols-[1fr_150px_120px] lg:items-center">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {i18nName(level.nameI18n, level.code)}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {level.sections?.length ? (
                              level.sections.map((section) => (
                                <span
                                  key={section.id}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                                >
                                  <span className="font-semibold">
                                    {sectionLetter(section)}
                                  </span>{" "}
                                  - {i18nName(section.nameI18n, section.code)}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-slate-500">
                                No section yet.
                              </span>
                            )}
                          </div>
                        </div>

                        <label className="grid gap-1 text-xs font-medium text-slate-500">
                          Nombre de sections
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={count}
                            onChange={(event) =>
                              updateCount(level.id, Number(event.target.value))
                            }
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={savingId === level.id}
                          onClick={() => saveLevel(level)}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {savingId === level.id ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {levels.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No grade levels yet. Use the quick setup above to create the school
            structure.
          </div>
        ) : null}
      </div>
    </div>
  );
}
