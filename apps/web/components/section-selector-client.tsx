"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SectionOption = {
  id: string;
  code: string;
  nameI18n: Record<string, string> | null;
  gradeLevelCode: string | null;
  gradeLevelNameI18n: Record<string, string> | null;
  academicDivision: "KINDERGARTEN" | "PRIMARY" | "SECONDARY" | null;
  gradeLevelDisplayOrder?: number;
  sectionDisplayOrder?: number;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
) {
  return value?.fr ?? value?.en ?? fallback;
}

function divisionLabel(value: string | null) {
  const labels: Record<string, string> = {
    KINDERGARTEN: "Maternelle / Kindergarten",
    PRIMARY: "Primaire / Primary",
    SECONDARY: "Secondaire / Secondary",
  };

  return value ? labels[value] ?? value : "Autres / Other";
}

function sectionLabel(section: SectionOption) {
  const grade = i18nName(
    section.gradeLevelNameI18n,
    section.gradeLevelCode ?? "",
  );

  const sectionName = i18nName(section.nameI18n, section.code);

  if (grade && sectionName.toLowerCase().includes(grade.toLowerCase())) {
    return sectionName;
  }

  return [grade, sectionName].filter(Boolean).join(" - ");
}

function groupSections(sections: SectionOption[]) {
  const groups: Record<string, SectionOption[]> = {};

  for (const section of sections) {
    const key = section.academicDivision ?? "OTHER";

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(section);
  }

  const order = ["KINDERGARTEN", "PRIMARY", "SECONDARY", "OTHER"];

  return order
    .filter((key) => groups[key]?.length)
    .map((key) => ({
      key,
      label: divisionLabel(key === "OTHER" ? null : key),
      sections: groups[key].sort((a, b) => {
        const gradeOrder =
          (a.gradeLevelDisplayOrder ?? 9999) -
          (b.gradeLevelDisplayOrder ?? 9999);

        if (gradeOrder !== 0) return gradeOrder;

        const sectionOrder =
          (a.sectionDisplayOrder ?? 9999) - (b.sectionDisplayOrder ?? 9999);

        if (sectionOrder !== 0) return sectionOrder;

        return a.code.localeCompare(b.code);
      }),
    }));
}

export function SectionSelectorClient({
  schoolId,
  sectionId,
  onSectionIdChange,
  label = "Classe / section",
  allowEmpty = false,
}: {
  schoolId: string;
  sectionId: string;
  onSectionIdChange: (value: string) => void;
  label?: string;
  allowEmpty?: boolean;
}) {
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSections() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(`/api/academic/section-options?${params}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load sections.");
      }

      setSections(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <select
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        value={sectionId}
        onChange={(event) => onSectionIdChange(event.target.value)}
        disabled={loading || sections.length === 0}
      >
        {allowEmpty ? <option value="">No section selected</option> : null}

        {groupSections(sections).map((group) => (
          <optgroup key={group.key} label={group.label}>
            {group.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {sectionLabel(section)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {loading ? (
        <div className="mt-2 text-xs text-slate-500">Loading sections...</div>
      ) : null}

      {error ? (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && sections.length === 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div>
            No class/section found for this school. Configure the academic
            structure before selecting a class.
          </div>

          <Link
            href="/academic-structure"
            className="mt-3 inline-flex rounded-lg bg-amber-700 px-3 py-2 text-xs font-medium text-white hover:bg-amber-800"
          >
            Configure academic structure
          </Link>
        </div>
      ) : null}
    </div>
  );
}

