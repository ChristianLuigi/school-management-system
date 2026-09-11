"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileUp,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import { SectionSelectorClient } from "@/components/section-selector-client";
import { StudentImportClient } from "@/components/student-import-client";
import { SchoolBadge } from "@/components/school-ui";
import { useI18n } from "@/components/i18n-provider";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

type StudentRow = {
  id: string;
  studentCode: string | null;
  studentStatus: string | null;
  firstName: string | null;
  lastName: string | null;
  gradeLevelCode: string | null;
  gradeLevelNameI18n: Record<string, string> | null;
  sectionCode: string | null;
  sectionNameI18n: Record<string, string> | null;
  currentEnrollment: {
    section: {
      id: string;
      code: string | null;
      nameI18n: Record<string, string> | null;
    };
    gradeLevel: {
      id: string | null;
      code: string | null;
      nameI18n: Record<string, string> | null;
      academicDivision: string | null;
    };
  } | null;
  createdAt: string;
};

type GradeLevelOption = {
  id: string;
  code: string;
  name_i18n: Record<string, string> | null;
  display_order?: number | null;
};

type DirectoryPagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

type StudentDirectoryResponse = {
  items: StudentRow[];
  pagination: DirectoryPagination;
};

const EMPTY_PAGINATION: DirectoryPagination = {
  page: 1,
  pageSize: 25,
  total: 0,
  pageCount: 0,
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
  locale: "fr" | "en",
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? fallback;
}

function currentClassLabel(
  student: StudentRow,
  locale: "fr" | "en",
  noClassLabel: string,
) {
  if (!student.currentEnrollment) return noClassLabel;

  const grade = i18nName(
    student.currentEnrollment.gradeLevel.nameI18n,
    student.currentEnrollment.gradeLevel.code ?? "",
    locale,
  );
  const section = i18nName(
    student.currentEnrollment.section.nameI18n,
    student.currentEnrollment.section.code ?? "",
    locale,
  );

  if (grade && section.toLowerCase().includes(grade.toLowerCase())) {
    return section;
  }

  return [grade, section].filter(Boolean).join(" - ") || noClassLabel;
}

function studentStatusTone(status: string | null): BadgeTone {
  if (status === "ACTIVE") return "green";
  if (status === "REGISTERED" || status === "PRE_REGISTERED") return "blue";
  if (
    status === "INACTIVE" ||
    status === "WITHDRAWN" ||
    status === "SUSPENDED"
  ) {
    return "amber";
  }
  return "neutral";
}

function studentName(student: StudentRow, unnamedLabel: string) {
  const name = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
  return name || student.studentCode || unnamedLabel;
}

function DirectorySkeleton() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <tr key={index} className="animate-pulse">
          <td className="px-5 py-4">
            <div className="h-9 w-44 rounded-lg bg-slate-100" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-24 rounded bg-slate-100" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-36 rounded bg-slate-100" />
          </td>
          <td className="px-5 py-4">
            <div className="h-6 w-16 rounded-full bg-slate-100" />
          </td>
          <td className="px-5 py-4">
            <div className="ml-auto h-8 w-16 rounded bg-slate-100" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function StudentsManagementClient({
  schoolId,
  canCreate,
}: {
  schoolId: string;
  canCreate: boolean;
}) {
  const { locale, t } = useI18n();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [pagination, setPagination] =
    useState<DirectoryPagination>(EMPTY_PAGINATION);
  const [gradeLevels, setGradeLevels] = useState<GradeLevelOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");
  const [enrollmentState, setEnrollmentState] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showImport, setShowImport] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  const activeFilterCount = [
    search.trim(),
    status,
    gradeLevelId,
    filterSectionId,
    enrollmentState,
  ].filter(Boolean).length;

  async function loadStudents(targetPage = page) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        schoolId,
        page: String(targetPage),
        pageSize: String(pageSize),
      });

      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (gradeLevelId) params.set("gradeLevelId", gradeLevelId);
      if (filterSectionId) params.set("sectionId", filterSectionId);
      if (enrollmentState) params.set("enrollmentState", enrollmentState);

      const res = await fetch(`/api/school-students?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => null)) as
        | StudentDirectoryResponse
        | { message?: string }
        | null;

      if (!res.ok) {
        throw new Error(
          body && "message" in body
            ? body.message
            : t("students.directoryLoadFailed"),
        );
      }
      if (!body || !("items" in body) || !Array.isArray(body.items)) {
        throw new Error(t("students.invalidDirectoryResponse"));
      }

      setRows(body.items);
      setPagination(body.pagination);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : t("students.directoryLoadFailed"));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await fetch(
        `/api/proxy/academic/grade-levels?schoolId=${encodeURIComponent(schoolId)}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);
      if (active && response.ok && Array.isArray(body)) {
        setGradeLevels(
          [...body].sort(
            (a: GradeLevelOption, b: GradeLevelOption) =>
              (a.display_order ?? 9999) - (b.display_order ?? 9999) ||
              a.code.localeCompare(b.code),
          ),
        );
      }
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [schoolId]);

  useEffect(() => {
    requestRef.current?.abort();
    const timeout = window.setTimeout(() => void loadStudents(page), 300);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    schoolId,
    search,
    status,
    gradeLevelId,
    filterSectionId,
    enrollmentState,
    page,
    pageSize,
  ]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const rangeStart = pagination.total
    ? (pagination.page - 1) * pagination.pageSize + 1
    : 0;
  const rangeEnd = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total,
  );

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-950">
                  {t("students.directoryTitle")}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {pagination.total}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {t("students.directorySubtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadStudents()}
              disabled={loading}
              title={t("students.refreshDirectory")}
              aria-label={t("students.refreshDirectory")}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            {canCreate ? (
              <button
                type="button"
                onClick={() => setShowImport((value) => !value)}
                title={locale === "fr" ? "Importer CSV" : "Import CSV"}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <FileUp className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {locale === "fr" ? "Importer CSV" : "Import CSV"}
                </span>
              </button>
            ) : null}
            {canCreate ? (
              <Link
                href="/students/new"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <Plus className="h-4 w-4" />
                {t("students.addStudent")}
              </Link>
            ) : null}
          </div>
        </div>

        {showImport ? (
          <div className="border-b border-slate-200 p-5">
            <StudentImportClient
              schoolId={schoolId}
              onClose={() => setShowImport(false)}
              onImported={() => {
                setShowImport(false);
                setPage(1);
                void loadStudents(1);
              }}
            />
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <SlidersHorizontal className="h-4 w-4" />
            {t("students.filters")}
            {activeFilterCount ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">
                {t("students.activeFilters", { count: activeFilterCount })}
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(150px,1fr))_auto] xl:items-end">
            <label>
              <span className="sr-only">{t("students.searchStudents")}</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={t("students.searchPlaceholder")}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </span>
            </label>

            <select
              aria-label={t("common.status")}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("students.allStatuses")}</option>
              <option value="PRE_REGISTERED">{t("students.preRegistered")}</option>
              <option value="REGISTERED">{t("students.registered")}</option>
              <option value="ACTIVE">{t("students.active")}</option>
              <option value="SUSPENDED">{t("students.suspended")}</option>
              <option value="WITHDRAWN">{t("students.withdrawn")}</option>
              <option value="TRANSFERRED">{t("students.transferred")}</option>
              <option value="GRADUATED">{t("students.graduated")}</option>
              <option value="ARCHIVED">{t("students.archived")}</option>
            </select>

            <select
              aria-label={t("students.allGradeLevels")}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              value={gradeLevelId}
              onChange={(event) => {
                setGradeLevelId(event.target.value);
                setFilterSectionId("");
                setPage(1);
              }}
            >
              <option value="">{t("students.allGradeLevels")}</option>
              {gradeLevels.map((gradeLevel) => (
                <option key={gradeLevel.id} value={gradeLevel.id}>
                  {i18nName(gradeLevel.name_i18n, gradeLevel.code, locale)}
                </option>
              ))}
            </select>

            <div className="min-w-0">
              <SectionSelectorClient
                schoolId={schoolId}
                sectionId={filterSectionId}
                onSectionIdChange={(value) => {
                  setFilterSectionId(value);
                  if (value) setGradeLevelId("");
                  setPage(1);
                }}
                label={t("students.classSection")}
                allowEmpty
                emptyLabel={t("students.allClasses")}
              />
            </div>

            <select
              aria-label={t("students.anyPlacement")}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              value={enrollmentState}
              onChange={(event) => {
                setEnrollmentState(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("students.anyPlacement")}</option>
              <option value="ASSIGNED">{t("students.classAssigned")}</option>
              <option value="UNASSIGNED">{t("students.noClass")}</option>
            </select>

            {activeFilterCount ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setGradeLevelId("");
                  setFilterSectionId("");
                  setEnrollmentState("");
                  setPage(1);
                }}
                title={t("students.clearFilters")}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                {t("common.clear")}
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block" aria-busy={loading}>
          <table className="min-w-full text-sm">
            <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{t("students.student")}</th>
                <th className="px-5 py-3">{t("students.code")}</th>
                <th className="px-5 py-3">{t("students.class")}</th>
                <th className="px-5 py-3">{t("common.status")}</th>
                <th className="px-5 py-3 text-right">
                  <span className="sr-only">{t("common.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody
              className={`divide-y divide-slate-100 ${loading && rows.length ? "opacity-60" : ""}`}
            >
              {loading && !rows.length ? <DirectorySkeleton /> : null}
              {rows.map((student) => (
                <tr
                  key={student.id}
                  className="transition hover:bg-slate-50/80"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">
                        {studentName(student, t("students.unnamedStudent"))
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="font-medium text-slate-950">
                        {studentName(student, t("students.unnamedStudent"))}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                    {student.studentCode ?? t("students.pending")}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 text-slate-700">
                      <GraduationCap className="h-4 w-4 text-slate-400" />
                      <span>
                        {currentClassLabel(
                          student,
                          locale,
                          t("students.noClassAssigned"),
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <SchoolBadge
                      tone={studentStatusTone(student.studentStatus)}
                    >
                      {student.studentStatus
                        ? t(
                            `students.${
                              student.studentStatus === "PRE_REGISTERED"
                                ? "preRegistered"
                                : student.studentStatus.toLowerCase()
                            }`,
                          )
                        : t("students.statusPending")}
                    </SchoolBadge>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/students/${student.id}`}
                        title={t("students.profile")}
                        aria-label={t("students.openProfile", {
                          name: studentName(
                            student,
                            t("students.unnamedStudent"),
                          ),
                        })}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {canCreate ? (
                        <Link
                          href={`/students/${student.id}/edit`}
                          title={t("common.edit")}
                          aria-label={t("students.editStudent", {
                            name: studentName(
                              student,
                              t("students.unnamedStudent"),
                            ),
                          })}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <UsersRound className="mx-auto h-8 w-8 text-slate-300" />
                    <div className="mt-3 font-medium text-slate-700">
                      {t("students.noStudentsFound")}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t("students.adjustFiltersOrAdd")}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div
          className={`divide-y divide-slate-100 md:hidden ${loading && rows.length ? "opacity-60" : ""}`}
        >
          {loading && !rows.length
            ? Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="animate-pulse p-4">
                  <div className="h-5 w-44 rounded bg-slate-100" />
                  <div className="mt-3 h-4 w-32 rounded bg-slate-100" />
                  <div className="mt-3 h-6 w-20 rounded-full bg-slate-100" />
                </div>
              ))
            : null}
          {rows.map((student) => (
            <article key={student.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-950">
                    {studentName(student, t("students.unnamedStudent"))}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-500">
                    {student.studentCode ?? t("students.codePending")}
                  </div>
                </div>
                <SchoolBadge tone={studentStatusTone(student.studentStatus)}>
                  {student.studentStatus
                    ? t(
                        `students.${
                          student.studentStatus === "PRE_REGISTERED"
                            ? "preRegistered"
                            : student.studentStatus.toLowerCase()
                        }`,
                      )
                    : t("students.statusPending")}
                </SchoolBadge>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <GraduationCap className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">
                  {currentClassLabel(
                    student,
                    locale,
                    t("students.noClassAssigned"),
                  )}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/students/${student.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                >
                  <Eye className="h-4 w-4" />
                  {t("students.profile")}
                </Link>
                {canCreate ? (
                  <Link
                    href={`/students/${student.id}/edit`}
                    aria-label={t("students.editStudent", {
                      name: studentName(
                        student,
                        t("students.unnamedStudent"),
                      ),
                    })}
                    className="rounded-xl border border-slate-200 p-2 text-slate-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
          {!rows.length && !loading ? (
            <div className="px-5 py-12 text-center">
              <UsersRound className="mx-auto h-8 w-8 text-slate-300" />
              <div className="mt-3 font-medium text-slate-700">
                {t("students.noStudentsFound")}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
          <div className="text-xs text-slate-500">
            {pagination.total
              ? t("students.studentsRange", {
                  start: rangeStart,
                  end: rangeEnd,
                  total: pagination.total,
                })
              : t("students.zeroStudents")}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">
              <span className="sr-only">{t("students.studentsPerPage")}</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
              >
                <option value={25}>
                  {t("students.perPage", { count: 25 })}
                </option>
                <option value={50}>
                  {t("students.perPage", { count: 50 })}
                </option>
                <option value={100}>
                  {t("students.perPage", { count: 100 })}
                </option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={loading || page <= 1}
              aria-label={t("common.previousPage")}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-16 text-center text-xs font-medium text-slate-600">
              {pagination.pageCount
                ? `${pagination.page} / ${pagination.pageCount}`
                : "—"}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={
                loading ||
                pagination.pageCount === 0 ||
                page >= pagination.pageCount
              }
              aria-label={t("common.nextPage")}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
