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
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning-subtle p-4 text-warning">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">
                {t("academic.noActiveAcademicYear")}
              </span>
            </div>
            {isAdministrator ? (
              <Link
                href="/academic-structure"
                className="inline-flex items-center gap-2 rounded-xl bg-warning px-3 py-2 text-sm font-semibold text-solid-foreground"
              >
                {t("common.configure")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        ) : (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-info-subtle p-3 text-info">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("academic.academicYear")}
                </div>
                <div className="mt-1 text-lg font-bold text-foreground">
                  {i18nName(
                    overview.academicYear.nameI18n,
                    overview.academicYear.status,
                    locale,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {dateLabel(overview.academicYear.startDate, locale)}
                  {" - "}
                  {dateLabel(overview.academicYear.endDate, locale)}
                </div>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                overview.academicYear.status === "ACTIVE"
                  ? "bg-success-subtle text-success"
                  : "bg-info-subtle text-info"
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
              tone: "bg-info-subtle text-info",
            },
            {
              label: isAdministrator
                ? t("academic.sections")
                : t("academic.mySections"),
              value: overview.metrics.sectionCount,
              icon: Layers3,
              tone: "bg-info-subtle text-info",
            },
            {
              label: isAdministrator
                ? t("academic.teachingAssignments")
                : t("academic.mySubjects"),
              value: overview.metrics.assignmentCount,
              icon: BookOpenCheck,
              tone: "bg-success-subtle text-success",
            },
            {
              label: t("academic.subjectCoverage"),
              value: `${overview.metrics.subjectCoveragePercent}%`,
              icon: CheckCircle2,
              tone: "bg-warning-subtle text-warning",
            },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <span className={`rounded-xl p-3 ${metric.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {metric.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{metric.label}</div>
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
                className="inline-flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-subtle px-3 py-2 text-sm font-medium text-warning"
              >
                <AlertTriangle className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        ) : isAdministrator && overview.academicYear ? (
          <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success-subtle px-3 py-2 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            {t("academic.operationallyReady")}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-surface-muted p-2 text-foreground">
                <GraduationCap className="h-5 w-5" />
              </span>
              <h2 className="font-semibold text-foreground">
                {isAdministrator
                  ? t("academic.classReadiness")
                  : t("academic.myClasses")}
              </h2>
            </div>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
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
                  className="rounded-2xl border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">
                        {sectionLabel(section, locale)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
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
                          ? "bg-danger-subtle text-danger"
                          : "bg-surface-muted text-muted-foreground"
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
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={`h-full rounded-full ${
                          section.atCapacity ? "bg-danger" : "bg-primary"
                        }`}
                        style={{ width: `${occupancy}%` }}
                      />
                    </div>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/attendance?sectionId=${section.id}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface"
                    >
                      {t("attendance.title")}
                    </Link>
                    <Link
                      href={`/gradebooks?sectionId=${section.id}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface"
                    >
                      {t("gradebooks.title")}
                    </Link>
                  </div>
                </article>
              );
            })}
            {!overview.sections.length ? (
              <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
                {t("academic.noAssignedOrConfiguredSections")}
              </div>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-success-subtle p-2 text-success">
                <BookOpenCheck className="h-5 w-5" />
              </span>
              <h2 className="font-semibold text-foreground">
                {isAdministrator
                  ? t("academic.teachingAssignments")
                  : t("academic.myTeachingAssignments")}
              </h2>
            </div>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {overview.assignments.length}
            </span>
          </header>
          <div className="divide-y divide-border">
            {overview.assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="grid gap-2 px-5 py-3.5 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <span className="w-fit rounded-lg bg-info-subtle px-2.5 py-1.5 font-mono text-xs font-semibold text-info">
                  {assignment.sectionCode}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">
                    {i18nName(
                      assignment.subjectNameI18n,
                      assignment.subjectCode,
                      locale,
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {assignment.subjectCode}
                  </div>
                </div>
                {isAdministrator ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
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
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-info/40 hover:bg-info-subtle hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
            {!overview.assignments.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t("academic.noActiveTeachingAssignments")}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AcademicsWorkspace>
  );
}
