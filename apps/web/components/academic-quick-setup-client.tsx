"use client";

import { useState } from "react";

type QuickGrade = {
  enabled: boolean;
  academicDivision: "KINDERGARTEN" | "PRIMARY" | "SECONDARY";
  gradeCode: string;
  nameFr: string;
  nameEn: string;
  displayOrder: number;
  sectionCount: number;
};

const DEFAULT_GRADES: QuickGrade[] = [
  {
    enabled: true,
    academicDivision: "KINDERGARTEN",
    gradeCode: "KG1",
    nameFr: "Maternelle 1",
    nameEn: "Kindergarten 1",
    displayOrder: 10,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "KINDERGARTEN",
    gradeCode: "KG2",
    nameFr: "Maternelle 2",
    nameEn: "Kindergarten 2",
    displayOrder: 20,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "KINDERGARTEN",
    gradeCode: "KG3",
    nameFr: "Maternelle 3",
    nameEn: "Kindergarten 3",
    displayOrder: 30,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "PRIMARY",
    gradeCode: "G1",
    nameFr: "1re Annee",
    nameEn: "1st Grade",
    displayOrder: 110,
    sectionCount: 2,
  },
  {
    enabled: true,
    academicDivision: "PRIMARY",
    gradeCode: "G2",
    nameFr: "2e Annee",
    nameEn: "2nd Grade",
    displayOrder: 120,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "PRIMARY",
    gradeCode: "G3",
    nameFr: "3e Annee",
    nameEn: "3rd Grade",
    displayOrder: 130,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "PRIMARY",
    gradeCode: "G4",
    nameFr: "4e Annee",
    nameEn: "4th Grade",
    displayOrder: 140,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "PRIMARY",
    gradeCode: "G5",
    nameFr: "5e Annee",
    nameEn: "5th Grade",
    displayOrder: 150,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "PRIMARY",
    gradeCode: "G6",
    nameFr: "6e Annee",
    nameEn: "6th Grade",
    displayOrder: 160,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "SECONDARY",
    gradeCode: "G7",
    nameFr: "7e Annee",
    nameEn: "7th Grade",
    displayOrder: 210,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "SECONDARY",
    gradeCode: "G8",
    nameFr: "8e Annee",
    nameEn: "8th Grade",
    displayOrder: 220,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "SECONDARY",
    gradeCode: "G9",
    nameFr: "9e Annee",
    nameEn: "9th Grade",
    displayOrder: 230,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "SECONDARY",
    gradeCode: "NS1",
    nameFr: "NS1",
    nameEn: "NS1",
    displayOrder: 240,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "SECONDARY",
    gradeCode: "NS2",
    nameFr: "NS2",
    nameEn: "NS2",
    displayOrder: 250,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "SECONDARY",
    gradeCode: "NS3",
    nameFr: "NS3",
    nameEn: "NS3",
    displayOrder: 260,
    sectionCount: 1,
  },
  {
    enabled: true,
    academicDivision: "SECONDARY",
    gradeCode: "NS4",
    nameFr: "NS4",
    nameEn: "NS4",
    displayOrder: 270,
    sectionCount: 1,
  },
];

const DIVISIONS: QuickGrade["academicDivision"][] = [
  "KINDERGARTEN",
  "PRIMARY",
  "SECONDARY",
];

function divisionLabel(value: QuickGrade["academicDivision"]) {
  const labels = {
    KINDERGARTEN: "Maternelle",
    PRIMARY: "Primaire / Fondamental 1er et 2e cycles",
    SECONDARY: "Secondaire / Fondamental 3e cycle + NS",
  };

  return labels[value];
}

export function AcademicQuickSetupClient({
  schoolId,
  onApplied,
}: {
  schoolId: string;
  onApplied?: () => Promise<void> | void;
}) {
  const [grades, setGrades] = useState<QuickGrade[]>(DEFAULT_GRADES);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateGrade(index: number, patch: Partial<QuickGrade>) {
    setGrades((current) =>
      current.map((grade, gradeIndex) =>
        gradeIndex === index ? { ...grade, ...patch } : grade,
      ),
    );
  }

  function enableDivision(
    division: QuickGrade["academicDivision"],
    enabled: boolean,
  ) {
    setGrades((current) =>
      current.map((grade) =>
        grade.academicDivision === division ? { ...grade, enabled } : grade,
      ),
    );
  }

  async function applySetup() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const enabledCount = grades.filter((grade) => grade.enabled).length;

      if (enabledCount === 0) {
        throw new Error("Select at least one class.");
      }

      const res = await fetch("/api/academic/quick-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          grades,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to apply academic setup.");
      }

      setMessage(
        `Structure saved: ${body.gradeCount} classes and ${body.sectionCount} sections.`,
      );

      await onApplied?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to apply academic setup.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-blue-950">
            Configuration rapide de la structure scolaire
          </h2>
          <p className="mt-1 text-sm text-blue-900">
            Choisissez les classes offertes par l'ecole et le nombre de
            salles/sections pour chaque classe.
          </p>
        </div>

        <button
          type="button"
          onClick={applySetup}
          disabled={saving}
          className="rounded-xl bg-blue-950 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save structure"}
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

      <div className="mt-5 space-y-5">
        {DIVISIONS.map((division) => {
          const divisionGrades = grades
            .map((grade, index) => ({ grade, index }))
            .filter((item) => item.grade.academicDivision === division);
          const divisionEnabled = divisionGrades.some((item) => item.grade.enabled);

          return (
            <div
              key={division}
              className="rounded-2xl border border-blue-100 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">
                  {divisionLabel(division)}
                </h3>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={divisionEnabled}
                    onChange={(event) =>
                      enableDivision(division, event.target.checked)
                    }
                  />
                  Activer tout
                </label>
              </div>

              <div className="mt-4 space-y-3">
                {divisionGrades.map(({ grade, index }) => (
                  <div
                    key={grade.gradeCode}
                    className={`grid gap-3 rounded-xl border p-3 md:grid-cols-[auto_1fr_130px] ${
                      grade.enabled
                        ? "border-slate-200 bg-slate-50"
                        : "border-slate-100 bg-white opacity-60"
                    }`}
                  >
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={grade.enabled}
                        onChange={(event) =>
                          updateGrade(index, { enabled: event.target.checked })
                        }
                      />
                      {grade.gradeCode}
                    </label>

                    <input
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      value={grade.nameFr}
                      onChange={(event) =>
                        updateGrade(index, { nameFr: event.target.value })
                      }
                    />

                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Sections
                      <input
                        type="number"
                        min={0}
                        max={10}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        value={grade.sectionCount}
                        onChange={(event) =>
                          updateGrade(index, {
                            sectionCount: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-blue-100 bg-white p-4 text-sm text-slate-600">
        This quick setup creates or updates classes and sections. It does not
        delete existing students, invoices, attendance, or grades.
      </div>
    </div>
  );
}
