import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  DoorOpen,
  GraduationCap,
  Layers3,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AcademicsWorkspace } from "@/components/academics-workspace";
import { getServerTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/messages";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type AcademicOverview = {
  viewMode: "ADMINISTRATOR" | "TEACHER";
  academicYear: {
    id: string;
    nameI18n: Record<string, string>;
    startDate: string;
    endDate: string;
    status: "ACTIVE" | "PLANNED";
  } | null;
  metrics: {
    sectionCount: number;
    studentCount: number;
    assignmentCount: number;
    subjectCoveragePercent: number;
  };
  readiness: {
    sectionsAtCapacity: number;
    sectionsWithoutCapacity: number;
    unassignedSubjectSlots: number;
    studentsWithoutPlacement: number;
  };
  sections: Array<{
    id: string;
    code: string;
    nameI18n: Record<string, string> | null;
    roomLabel: string | null;
    capacity: number | null;
    studentCount: number;
    availableSeats: number | null;
    atCapacity: boolean;
    gradeLevel: {
      id: string;
      code: string;
      nameI18n: Record<string, string> | null;
      academicDivision: string | null;
    };
    configuredSubjectCount: number;
    assignedSubjectCount: number;
  }>;
  assignments: Array<{
    id: string;
    sectionId: string;
    sectionCode: string;
    subjectId: string;
    subjectCode: string;
    subjectNameI18n: Record<string, string> | null;
    teacherStaffAccountId: string;
    teacherName: string;
  }>;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
  locale: Locale,
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? fallback;
}

function sectionLabel(
  section: AcademicOverview["sections"][number],
  locale: Locale,
) {
  const grade = i18nName(
    section.gradeLevel.nameI18n,
    section.gradeLevel.code,
    locale,
  );
  const name = i18nName(section.nameI18n, section.code, locale);

  return name.toLowerCase().includes(grade.toLowerCase())
    ? name
    : [grade, name].filter(Boolean).join(" - ");
}

function dateLabel(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-HT" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value + "T00:00:00"));
}

export default async function AcademicsPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const effectiveRoles = resolveEffectiveRoles(context);
  const { locale, t } = await getServerTranslator();
  const overview = await serverApiGet<AcademicOverview>(
    `/academic/overview?schoolId=${encodeURIComponent(schoolId)}`,
  );
  const isAdministrator = overview.viewMode === "ADMINISTRATOR";
  const readinessItems = isAdministrator
    ? [
        overview.readiness.studentsWithoutPlacement
          ? {
              label: t("academic.studentsWithoutClass", {
                count: overview.readiness.studentsWithoutPlacement,
              }),
              href: "/students?placement=unassigned",
            }
          : null,
        overview.readiness.unassignedSubjectSlots
          ? {
              label: t("academic.assignmentsMissing", {
                count: overview.readiness.unassignedSubjectSlots,
              }),
              href: "/staff?tab=assignments",
            }
          : null,
        overview.readiness.sectionsAtCapacity
          ? {
              label: t("academic.sectionsAtCapacity", {
                count: overview.readiness.sectionsAtCapacity,
              }),
              href: "/academic-structure",
            }
          : null,
        overview.readiness.sectionsWithoutCapacity
          ? {
              label: t("academic.sectionsWithoutCapacity", {
                count: overview.readiness.sectionsWithoutCapacity,
              }),
              href: "/academic-structure",
            }
          : null,
      ].filter((item): item is { label: string; href: string } => Boolean(item))
    : [];

  return (
    <AcademicsWorkspace currentRoles={effectiveRoles}>
      <div className="space-y-5">
        {!overview.academicYear ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">
                {t("academic.noActiveAcademicYear")}
              </span>
            </div>
            {isAdministrator ? (
              <Link
                href="/academic-structure"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-800 px-3 py-2 text-sm font-semibold text-white"
              >
                {t("common.configure")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        ) : (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("academic.academicYear")}
                </div>
                <div className="mt-1 text-lg font-bold text-slate-950">
                  {i18nName(
                    overview.academicYear.nameI18n,
                    overview.academicYear.status,
                    locale,
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {dateLabel(overview.academicYear.startDate, locale)}
                  {" - "}
                  {dateLabel(overview.academicYear.endDate, locale)}
                </div>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                overview.academicYear.status === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              {overview.academicYear.status === "ACTIVE"
                ? t("common.active")
                : t("academic.planned")}
            </span>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: isAdministrator
                ? t("academic.studentsPlaced")
                : t("academic.myStudents"),
              value: overview.metrics.studentCount,
              icon: UsersRound,
              tone: "bg-blue-50 text-blue-700",
            },
            {
              label: isAdministrator
                ? t("academic.sections")
                : t("academic.mySections"),
              value: overview.metrics.sectionCount,
              icon: Layers3,
              tone: "bg-violet-50 text-violet-700",
            },
            {
              label: isAdministrator
                ? t("academic.teachingAssignments")
                : t("academic.mySubjects"),
              value: overview.metrics.assignmentCount,
              icon: BookOpenCheck,
              tone: "bg-emerald-50 text-emerald-700",
            },
            {
              label: t("academic.subjectCoverage"),
              value: `${overview.metrics.subjectCoveragePercent}%`,
              icon: CheckCircle2,
              tone: "bg-amber-50 text-amber-700",
            },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className={`rounded-xl p-3 ${metric.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-2xl font-bold text-slate-950">
                    {metric.value}
                  </div>
                  <div className="text-sm text-slate-500">{metric.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {readinessItems.length ? (
          <div className="flex flex-wrap gap-2">
            {readinessItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
              >
                <AlertTriangle className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        ) : isAdministrator && overview.academicYear ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {t("academic.operationallyReady")}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-slate-100 p-2 text-slate-700">
                <GraduationCap className="h-5 w-5" />
              </span>
              <h2 className="font-semibold text-slate-950">
                {isAdministrator
                  ? t("academic.classReadiness")
                  : t("academic.myClasses")}
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {overview.sections.length}
            </span>
          </header>
          <div className="grid gap-3 p-5 lg:grid-cols-2">
            {overview.sections.map((section) => {
              const occupancy =
                section.capacity === null
                  ? null
                  : Math.min(
                      Math.round(
                        (section.studentCount / Math.max(section.capacity, 1)) *
                          100,
                      ),
                      100,
                    );
              return (
                <article
                  key={section.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">
                        {sectionLabel(section, locale)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                        {section.roomLabel ? (
                          <span className="inline-flex items-center gap-1">
                            <DoorOpen className="h-3.5 w-3.5" />
                            {section.roomLabel}
                          </span>
                        ) : null}
                        <span>
                          {t("academic.subjectsAssigned", {
                            assigned: section.assignedSubjectCount,
                            configured: section.configuredSubjectCount,
                          })}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        section.atCapacity
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {section.capacity === null
                        ? t("academic.studentsCount", {
                            count: section.studentCount,
                          })
                        : `${section.studentCount}/${section.capacity}`}
                    </span>
                  </div>
                  {occupancy !== null ? (
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          section.atCapacity ? "bg-red-500" : "bg-blue-600"
                        }`}
                        style={{ width: `${occupancy}%` }}
                      />
                    </div>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/attendance?sectionId=${section.id}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t("attendance.title")}
                    </Link>
                    <Link
                      href={`/gradebooks?sectionId=${section.id}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t("gradebooks.title")}
                    </Link>
                  </div>
                </article>
              );
            })}
            {!overview.sections.length ? (
              <div className="col-span-full py-10 text-center text-sm text-slate-500">
                {t("academic.noAssignedOrConfiguredSections")}
              </div>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <BookOpenCheck className="h-5 w-5" />
              </span>
              <h2 className="font-semibold text-slate-950">
                {isAdministrator
                  ? t("academic.teachingAssignments")
                  : t("academic.myTeachingAssignments")}
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {overview.assignments.length}
            </span>
          </header>
          <div className="divide-y divide-slate-100">
            {overview.assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="grid gap-2 px-5 py-3.5 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <span className="w-fit rounded-lg bg-blue-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-blue-700">
                  {assignment.sectionCode}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-950">
                    {i18nName(
                      assignment.subjectNameI18n,
                      assignment.subjectCode,
                      locale,
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {assignment.subjectCode}
                  </div>
                </div>
                {isAdministrator ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <UserRound className="h-4 w-4 text-slate-400" />
                    {assignment.teacherName}
                  </div>
                ) : (
                  <span />
                )}
                <Link
                  href={`/gradebooks?sectionId=${assignment.sectionId}&subjectId=${assignment.subjectId}`}
                  aria-label={t("academic.openGradebook", {
                    subject: assignment.subjectCode,
                  })}
                  title={t("gradebooks.title")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
            {!overview.assignments.length ? (
              <div className="py-10 text-center text-sm text-slate-500">
                {t("academic.noActiveTeachingAssignments")}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AcademicsWorkspace>
  );
}
