"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import { SectionSelectorClient } from "@/components/section-selector-client";
import { StudentImportClient } from "@/components/student-import-client";
import { GuardianImportClient } from "@/components/guardian-import-client";
import { BulkCleanupClient } from "@/components/bulk-cleanup-client";
import { BulkPlacementClient } from "@/components/bulk-placement-client";
import { RecordActions } from "@/components/record-actions";
import {
  EmptySchoolState,
  SchoolBadge,
  SchoolFeedback,
  schoolActionClass,
} from "@/components/school-ui";
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
  pageSize: 10,
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
            <div className="h-9 w-44 rounded-lg bg-surface-muted" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-24 rounded bg-surface-muted" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-36 rounded bg-surface-muted" />
          </td>
          <td className="px-5 py-4">
            <div className="h-6 w-16 rounded-full bg-surface-muted" />
          </td>
          <td className="px-5 py-4">
            <div className="ml-auto h-8 w-16 rounded bg-surface-muted" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function StudentsManagementClient({
  schoolId,
  canCreate,
  canImport = canCreate,
}: {
  schoolId: string;
  canCreate: boolean;
  canImport?: boolean;
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
  const [pageSize, setPageSize] = useState(10);
  const [showImport, setShowImport] = useState(false);
  const [showGuardianImport, setShowGuardianImport] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);
  const [showPlacement, setShowPlacement] = useState(false);
  const selectionScope = JSON.stringify([schoolId, search, status, gradeLevelId, filterSectionId, enrollmentState, page, pageSize]);
  const [selection, setSelection] = useState<{ scope: string; ids: string[] }>({ scope: "", ids: [] });
  const selectedIds = selection.scope === selectionScope ? selection.ids : [];
  function setSelectedIds(value: string[] | ((ids: string[]) => string[])) {
    setSelection((current) => ({ scope: selectionScope, ids: typeof value === "function" ? value(current.scope === selectionScope ? current.ids : []) : value }));
  }
  const [placementIds, setPlacementIds] = useState<string[]>([]);
  const fr = locale === "fr";
  function toggleSelection(id: string) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  }
  function openPanel(panel: "import" | "guardians" | "cleanup" | "placement") {
    setShowImport(panel === "import");
    setShowGuardianImport(panel === "guardians");
    setShowCleanup(panel === "cleanup");
    setShowPlacement(panel === "placement");
    if (panel === "placement") setPlacementIds([...selectedIds]);
  }
  function studentActions(student: StudentRow) {
    return [
      { label: t("students.profile"), href: `/students/${student.id}` },
      ...(canCreate ? [{ label: t("common.edit"), href: `/students/${student.id}/edit` }] : []),
    ];
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  const activeFilterCount = [
    search.trim(),
    status,
    gradeLevelId,
    filterSectionId,
    enrollmentState,
  ].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setStatus("");
    setGradeLevelId("");
    setFilterSectionId("");
    setEnrollmentState("");
    setPage(1);
  }

  async function loadStudents(targetPage = page) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setSelectedIds([]);
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

      if (!controller.signal.aborted) {
        setRows(body.items);
        setPagination(body.pagination);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(
        err instanceof Error ? err.message : t("students.directoryLoadFailed"),
      );
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
    return () => {
      window.clearTimeout(timeout);
      requestRef.current?.abort();
    };
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
      <p role="status" className="sr-only">
        {loading
          ? t("students.loadingDirectory")
          : error
            ? ""
            : t("students.resultsCount", { count: pagination.total })}
      </p>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-info-subtle p-2.5 text-info">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">
                  {t("students.directoryHeading")}
                </h2>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {loading || error ? "—" : pagination.total}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadStudents()}
              disabled={loading}
              title={t("students.refreshDirectory")}
              aria-label={t("students.refreshDirectory")}
              className="rounded-xl border border-border p-2.5 text-muted-foreground transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            {canImport && <RecordActions label={t("common.actions")} disabled={loading} actions={selectedIds.length ? [
              { label: fr ? "Affecter la sélection à une classe" : "Assign selection to a class", disabled: rows.some((row) => selectedIds.includes(row.id) && !!row.currentEnrollment), onClick: () => openPanel("placement") },
              { label: fr ? "Effacer la sélection" : "Clear selection", onClick: () => setSelectedIds([]) },
            ] : [
              { label: t("students.importCsv"), onClick: () => openPanel("import") },
              { label: fr ? "Importer des responsables" : "Import guardians", onClick: () => openPanel("guardians") },
              { label: fr ? "Suppression groupée (sélection sécurisée)" : "Bulk deletion (protected selection)", onClick: () => openPanel("cleanup") },
              { label: fr ? "Affectation groupée" : "Bulk class placement", onClick: () => openPanel("placement") },
            ]} />}
            {canCreate ? (
              <Link
                href="/students/new"
                className={schoolActionClass("primary")}
              >
                <Plus className="h-4 w-4" />
                {t("students.addStudent")}
              </Link>
            ) : null}
          </div>
        </div>

        {showPlacement ? (
          <div id="bulk-placement-panel" className="border-b border-border p-5">
            <BulkPlacementClient
              key={`${schoolId}:${placementIds.join(",")}`}
              schoolId={schoolId}
              initialStudentIds={placementIds}
              onClose={() => setShowPlacement(false)}
              onAssigned={() => {
                setPage(1);
                void loadStudents(1);
              }}
            />
          </div>
        ) : null}
        {showCleanup ? (
          <div id="bulk-cleanup-panel" className="border-b border-border p-5">
            <BulkCleanupClient
              key={schoolId}
              schoolId={schoolId}
              onClose={() => setShowCleanup(false)}
              onDeleted={() => {
                setPage(1);
                void loadStudents(1);
              }}
            />
          </div>
        ) : null}
        {showGuardianImport ? (
          <div
            id="guardian-import-panel"
            className="border-b border-border p-5"
          >
            <GuardianImportClient
              key={schoolId}
              schoolId={schoolId}
              onClose={() => setShowGuardianImport(false)}
            />
          </div>
        ) : null}
        {showImport ? (
          <div id="student-import-panel" className="border-b border-border p-5">
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
          <div className="mx-5 mt-4">
            <SchoolFeedback
              action={
                <button
                  type="button"
                  onClick={() => void loadStudents()}
                  disabled={loading}
                  className={schoolActionClass()}
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  {t("students.retry")}
                </button>
              }
            >
              {error}
            </SchoolFeedback>
          </div>
        ) : null}

        <div className="border-b border-border bg-surface/70 px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            {t("students.filters")}
            {activeFilterCount ? (
              <span className="rounded-full bg-info-subtle px-2 py-0.5 text-[11px] text-info">
                {t("students.activeFilters", { count: activeFilterCount })}
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:items-end">
            <label>
              <span className="block text-sm font-medium text-foreground">
                {t("students.searchStudents")}
              </span>
              <span className="relative mt-1 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="w-full rounded-xl border border-input bg-surface py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-info/40 focus:ring-2 focus:ring-ring"
                  placeholder={t("students.searchPlaceholder")}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </span>
            </label>

            <label className="grid gap-1 text-sm font-medium text-foreground">
              {t("common.status")}
              <select
                aria-label={t("common.status")}
                className="rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-info/40"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("students.allStatuses")}</option>
                <option value="PRE_REGISTERED">
                  {t("students.preRegistered")}
                </option>
                <option value="REGISTERED">{t("students.registered")}</option>
                <option value="ACTIVE">{t("students.active")}</option>
                <option value="SUSPENDED">{t("students.suspended")}</option>
                <option value="WITHDRAWN">{t("students.withdrawn")}</option>
                <option value="TRANSFERRED">{t("students.transferred")}</option>
                <option value="GRADUATED">{t("students.graduated")}</option>
                <option value="ARCHIVED">{t("students.archived")}</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium text-foreground">
              {t("students.gradeFilter")}
              <select
                aria-label={t("students.allGradeLevels")}
                className="rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-info/40"
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
            </label>

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
                disableFullSections={false}
                emptyActionHref={null}
                emptyLabel={t("students.allClasses")}
              />
            </div>

            <label className="grid gap-1 text-sm font-medium text-foreground">
              {t("students.placementFilter")}
              <select
                aria-label={t("students.anyPlacement")}
                className="rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-info/40"
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
            </label>

            {activeFilterCount ? (
              <button
                type="button"
                onClick={clearFilters}
                title={t("students.clearFilters")}
                className={schoolActionClass()}
              >
                <X className="h-4 w-4" />
                {t("common.clear")}
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>

        {canImport && <div className="flex items-center gap-3 border-b border-border px-5 py-3 text-sm text-muted-foreground">
          <input type="checkbox" aria-label={fr ? "Sélectionner toute la page" : "Select this page"} disabled={loading || !rows.length}
            checked={!!rows.length && selectedIds.length === rows.length}
            ref={(node) => { if (node) node.indeterminate = selectedIds.length > 0 && selectedIds.length < rows.length; }}
            onChange={(event) => setSelectedIds(event.target.checked ? rows.map((row) => row.id) : [])} />
          <span aria-live="polite">{selectedIds.length} {fr ? "sélectionné(s) · page affichée uniquement" : "selected · current page only"}</span>
        </div>}
        <div className="hidden overflow-x-auto md:block" aria-busy={loading}>
          <table className="min-w-full text-sm">
            <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              className={`divide-y divide-border ${loading && rows.length ? "opacity-60" : ""}`}
            >
              {loading && !rows.length ? <DirectorySkeleton /> : null}
              {rows.map((student) => (
                <tr key={student.id} className="transition hover:bg-surface/80">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {canImport && <input type="checkbox" disabled={loading} checked={selectedIds.includes(student.id)} onChange={() => toggleSelection(student.id)} aria-label={`${fr ? "Sélectionner" : "Select"} ${studentName(student, t("students.unnamedStudent"))}`} />}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted font-semibold text-muted-foreground">
                        {studentName(student, t("students.unnamedStudent"))
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="font-medium text-foreground">
                        {studentName(student, t("students.unnamedStudent"))}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                    {student.studentCode ?? t("students.pending")}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 text-foreground">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
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
                      <RecordActions compact label={`${t("common.actions")} · ${studentName(student, t("students.unnamedStudent"))}`} actions={studentActions(student)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          aria-busy={loading}
          className={`divide-y divide-border md:hidden ${loading && rows.length ? "opacity-60" : ""}`}
        >
          {loading && !rows.length
            ? Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="animate-pulse p-4">
                  <div className="h-5 w-44 rounded bg-surface-muted" />
                  <div className="mt-3 h-4 w-32 rounded bg-surface-muted" />
                  <div className="mt-3 h-6 w-20 rounded-full bg-surface-muted" />
                </div>
              ))
            : null}
          {rows.map((student) => (
            <article key={student.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {canImport && <input type="checkbox" disabled={loading} checked={selectedIds.includes(student.id)} onChange={() => toggleSelection(student.id)} aria-label={`${fr ? "Sélectionner" : "Select"} ${studentName(student, t("students.unnamedStudent"))}`} />}
                  <div className="truncate font-semibold text-foreground">
                    {studentName(student, t("students.unnamedStudent"))}
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
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
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {currentClassLabel(
                    student,
                    locale,
                    t("students.noClassAssigned"),
                  )}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <RecordActions compact label={`${t("common.actions")} · ${studentName(student, t("students.unnamedStudent"))}`} actions={studentActions(student)} />
              </div>
            </article>
          ))}
        </div>
        {!rows.length && !loading && !error ? (
          <div className="p-5">
            <EmptySchoolState
              icon={<UsersRound className="h-8 w-8" />}
              title={t(
                activeFilterCount
                  ? "students.noStudentsFound"
                  : "students.emptyDirectory",
              )}
              description={t(
                activeFilterCount
                  ? "students.noMatchesHint"
                  : canCreate
                    ? "students.emptyDirectoryHint"
                    : "students.emptyReadOnlyHint",
              )}
              action={
                activeFilterCount ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={schoolActionClass()}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                    {t("students.clearFilters")}
                  </button>
                ) : canCreate ? (
                  <Link
                    href="/students/new"
                    className={schoolActionClass("primary")}
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    {t("students.addStudent")}
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3">
          <div className="text-xs text-muted-foreground">
            {loading
              ? t("students.loadingDirectory")
              : error
                ? "—"
                : pagination.total
                  ? t("students.studentsRange", {
                      start: rangeStart,
                      end: rangeEnd,
                      total: pagination.total,
                    })
                  : t("students.zeroStudents")}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">
              <span className="sr-only">{t("students.studentsPerPage")}</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
              >
                <option value={10}>
                  {t("students.perPage", { count: 10 })}
                </option>
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
              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-surface disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-16 text-center text-xs font-medium text-muted-foreground">
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
              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-surface disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
