"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, DoorOpen, UsersRound } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export type SectionOption = {
  id: string;
  code: string;
  nameI18n: Record<string, string> | null;
  gradeLevelCode: string | null;
  gradeLevelNameI18n: Record<string, string> | null;
  academicDivision: "KINDERGARTEN" | "PRIMARY" | "SECONDARY" | null;
  gradeLevelDisplayOrder?: number;
  sectionDisplayOrder?: number;
  academicYearId: string;
  academicYearNameI18n: Record<string, string> | null;
  academicYearStatus: "ACTIVE" | "PLANNED";
  capacity: number | null;
  roomLabel: string | null;
  activeEnrollmentCount: number;
  availableSeats: number | null;
  atCapacity: boolean;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
  locale: "fr" | "en" = "fr",
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? fallback;
}

function divisionLabel(
  value: string | null,
  translate: (key: string) => string,
) {
  return value
    ? translate(`academic.${value.toLowerCase()}`)
    : translate("academic.other");
}

export function sectionOptionLabel(
  section: SectionOption,
  locale: "fr" | "en" = "fr",
  translate?: (key: string, params?: Record<string, string | number>) => string,
) {
  const grade = i18nName(
    section.gradeLevelNameI18n,
    section.gradeLevelCode ?? "",
    locale,
  );
  const sectionName = i18nName(section.nameI18n, section.code, locale);
  const base = sectionName.toLowerCase().includes(grade.toLowerCase())
    ? sectionName
    : [grade, sectionName].filter(Boolean).join(" - ");
  const occupancy =
    section.capacity === null
      ? translate?.("academic.enrolledCount", {
          count: section.activeEnrollmentCount,
        }) ?? `${section.activeEnrollmentCount} enrolled`
      : `${section.activeEnrollmentCount}/${section.capacity}`;

  const full = translate?.("academic.full") ?? "Full";
  return `${base} · ${occupancy}${section.atCapacity ? ` · ${full}` : ""}`;
}

function groupSections(
  sections: SectionOption[],
  locale: "fr" | "en",
  translate: (key: string) => string,
) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      sections: SectionOption[];
      yearStatus: "ACTIVE" | "PLANNED";
    }
  >();

  for (const section of sections) {
    const key = `${section.academicYearId}:${section.academicDivision ?? "OTHER"}`;
    if (!groups.has(key)) {
      const year = i18nName(
        section.academicYearNameI18n,
        section.academicYearStatus,
        locale,
      );
      groups.set(key, {
        key,
        label: `${year} · ${divisionLabel(section.academicDivision, translate)}`,
        sections: [],
        yearStatus: section.academicYearStatus,
      });
    }
    groups.get(key)!.sections.push(section);
  }

  return Array.from(groups.values())
    .sort((a, b) => {
      if (a.yearStatus !== b.yearStatus) {
        return a.yearStatus === "ACTIVE" ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    })
    .map((group) => ({
      ...group,
      sections: group.sections.sort((a, b) => {
        const gradeOrder =
          (a.gradeLevelDisplayOrder ?? 9999) -
          (b.gradeLevelDisplayOrder ?? 9999);
        if (gradeOrder !== 0) return gradeOrder;
        const sectionOrder =
          (a.sectionDisplayOrder ?? 9999) - (b.sectionDisplayOrder ?? 9999);
        return sectionOrder !== 0 ? sectionOrder : a.code.localeCompare(b.code);
      }),
    }));
}

export function SectionSelectorClient({
  schoolId,
  sectionId,
  onSectionIdChange,
  onSectionDetailsChange,
  label = "Class / section",
  allowEmpty = false,
  emptyLabel = "No section selected",
  allowFullSectionId = null,
  autoSelectFirst = false,
  disableFullSections = true,
  includePlanned = true,
  emptyActionHref = "/academic-structure",
  emptyActionLabel = "Configure",
}: {
  schoolId: string;
  sectionId: string;
  onSectionIdChange: (value: string) => void;
  onSectionDetailsChange?: (section: SectionOption | null) => void;
  label?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  allowFullSectionId?: string | null;
  autoSelectFirst?: boolean;
  disableFullSections?: boolean;
  includePlanned?: boolean;
  emptyActionHref?: string | null;
  emptyActionLabel?: string;
}) {
  const { locale, t } = useI18n();
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
        throw new Error(body?.message ?? t("academic.loadSectionsFailed"));
      }

      const options = (Array.isArray(body) ? body : []).filter(
        (item: SectionOption) =>
          includePlanned || item.academicYearStatus === "ACTIVE",
      );
      setSections(options);

      const selectedOption = options.find(
        (item: SectionOption) => item.id === sectionId,
      );
      const nextSectionId = selectedOption
        ? sectionId
        : autoSelectFirst
          ? (options[0]?.id ?? "")
          : "";
      const nextSelection =
        options.find((item: SectionOption) => item.id === nextSectionId) ??
        null;

      if (nextSectionId !== sectionId) {
        onSectionIdChange(nextSectionId);
      }
      onSectionDetailsChange?.(nextSelection);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("academic.loadSectionsFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const selected = sections.find((section) => section.id === sectionId) ?? null;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        aria-busy={loading}
        className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        value={sectionId}
        onChange={(event) => {
          const value = event.target.value;
          onSectionIdChange(value);
          onSectionDetailsChange?.(
            sections.find((section) => section.id === value) ?? null,
          );
        }}
        disabled={loading || sections.length === 0}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {groupSections(sections, locale, t).map((group) => (
          <optgroup key={group.key} label={group.label}>
            {group.sections.map((section) => (
              <option
                key={section.id}
                value={section.id}
                disabled={
                  disableFullSections &&
                  section.atCapacity &&
                  section.id !== allowFullSectionId
                }
              >
                {sectionOptionLabel(section, locale, t)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {selected ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {i18nName(
              selected.academicYearNameI18n,
              selected.academicYearStatus,
              locale,
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersRound className="h-3.5 w-3.5" />
            {selected.capacity === null
              ? t("academic.enrolledCount", {
                  count: selected.activeEnrollmentCount,
                })
              : t("academic.availableSeats", {
                  count: selected.availableSeats ?? 0,
                })}
          </span>
          {selected.roomLabel ? (
            <span className="inline-flex items-center gap-1">
              <DoorOpen className="h-3.5 w-3.5" />
              {selected.roomLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div role="status" className="mt-2 text-xs text-slate-500">
          {t("academic.loadingSections")}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
      {!loading && sections.length === 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <span>{t("academic.noAvailableSections")}</span>
          {emptyActionHref ? (
            <Link
              href={emptyActionHref}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              {emptyActionLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
