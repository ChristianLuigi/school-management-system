"use client";

import { useEffect, useState } from "react";

type GradingPeriodOption = {
  id: string;
  nameI18n: Record<string, string>;
  startDate: string | null;
  endDate: string | null;
};

type SectionOption = {
  id: string;
  code: string;
  nameI18n: Record<string, string>;
  gradeLevelCode: string;
  gradeLevelNameI18n: Record<string, string>;
};

type AcademicOptions = {
  schoolId: string;
  gradingPeriods: GradingPeriodOption[];
  sections: SectionOption[];
};

function i18nName(value: Record<string, string> | null | undefined, fallback: string) {
  return value?.fr ?? value?.en ?? fallback;
}

function gradingPeriodLabel(period: GradingPeriodOption) {
  const name = i18nName(period.nameI18n, period.id);

  if (period.startDate && period.endDate) {
    return `${name} (${period.startDate} - ${period.endDate})`;
  }

  return name;
}

function sectionLabel(section: SectionOption) {
  const gradeName = i18nName(
    section.gradeLevelNameI18n,
    section.gradeLevelCode,
  );

  const sectionName = i18nName(section.nameI18n, section.code);

  return `${gradeName} - ${sectionName}`;
}

export function ReportCardAcademicSelectorsClient({
  schoolId,
  gradingPeriodId,
  sectionId,
  onGradingPeriodIdChange,
  onSectionIdChange,
  mode = "required",
}: {
  schoolId: string;
  gradingPeriodId: string;
  sectionId: string;
  onGradingPeriodIdChange: (value: string) => void;
  onSectionIdChange: (value: string) => void;
  mode?: "required" | "filter";
}) {
  const [options, setOptions] = useState<AcademicOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadOptions() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(`/api/report-cards/options?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load academic options.");
      }

      setOptions(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load academic options.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
          Loading academic options...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Grading Period
          </span>

          <select
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={gradingPeriodId}
            onChange={(event) => onGradingPeriodIdChange(event.target.value)}
          >
            <option value="">
              {mode === "filter" ? "All grading periods" : "Select grading period"}
            </option>

            {options?.gradingPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {gradingPeriodLabel(period)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Section</span>

          <select
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={sectionId}
            onChange={(event) => onSectionIdChange(event.target.value)}
          >
            <option value="">
              {mode === "filter" ? "All sections" : "Select section"}
            </option>

            {options?.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {sectionLabel(section)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}