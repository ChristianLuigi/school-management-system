"use client";

import { useEffect, useState } from "react";

export type SelectedSection = {
  id: string;
  code: string;
  nameI18n: Record<string, string>;
  gradeLevelCode: string;
  gradeLevelNameI18n: Record<string, string>;
};

type AcademicOptions = {
  schoolId: string;
  sections: SelectedSection[];
};

function i18nName(value: Record<string, string> | null | undefined, fallback: string) {
  return value?.fr ?? value?.en ?? fallback;
}

function sectionLabel(section: SelectedSection) {
  const gradeName = i18nName(
    section.gradeLevelNameI18n,
    section.gradeLevelCode,
  );

  const sectionName = i18nName(section.nameI18n, section.code);

  return `${gradeName} - ${sectionName}`;
}

export function SectionSelectorClient({
  schoolId,
  sectionId,
  onSectionIdChange,
  label = "Section",
  allowEmpty = false,
}: {
  schoolId: string;
  sectionId: string;
  onSectionIdChange: (value: string) => void;
  label?: string;
  allowEmpty?: boolean;
}) {
  const [sections, setSections] = useState<SelectedSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSections() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(`/api/report-cards/options?${params.toString()}`, {
        cache: "no-store",
      });

      const body: AcademicOptions | { message?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          "message" in body ? body.message : "Failed to load sections.",
        );
      }

      setSections((body as AcademicOptions).sections ?? []);
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
      <label className="block">
        <span className="text-sm font-medium text-slate-700">{label}</span>

        <select
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          value={sectionId}
          onChange={(event) => onSectionIdChange(event.target.value)}
        >
          {allowEmpty ? <option value="">All sections</option> : null}

          {!allowEmpty ? <option value="">Select section</option> : null}

          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {sectionLabel(section)}
            </option>
          ))}
        </select>
      </label>

      {loading ? (
        <div className="mt-2 text-xs text-slate-500">Loading sections...</div>
      ) : null}

      {error ? (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}