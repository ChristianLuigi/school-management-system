"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { createSafeCsv } from "@/lib/csv/safe-csv";

type Report = {
  generatedAt: string;
  credentialWindowDays: number;
  totals: {
    staff: number;
    unlinkedAccounts: number;
    missingPayrollProfiles: number;
    teachersWithoutAssignments: number;
    expiredCredentials: number;
    expiringCredentials: number;
    pendingLeaveRequests: number;
    payrollReady: number;
    payrollBlocked: number;
    accessIssues: number;
    currentHeadcount: number;
    teachersAssigned: number;
    teacherCoverageIssues: number;
  };
  statusCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  payrollEligibility: Array<{
    staffId: string;
    staffCode: string | null;
    firstName: string | null;
    lastName: string | null;
    employmentStatus: string;
    eligibilityStatus: string;
    currencyCode: string | null;
    payFrequency: string | null;
    compensationEffectiveFrom: string | null;
  }>;
  accessReconciliation: Array<{
    staffId: string;
    staffCode: string | null;
    firstName: string | null;
    lastName: string | null;
    staffType: string | null;
    employmentStatus: string;
    linked: boolean;
    accountStatus: string | null;
    emailVerified: boolean;
    membershipStatus: string | null;
    activeRoles: string[];
    activeSessionCount: number;
    accessStatus: string;
    requiresAttention: boolean;
  }>;
  departmentHeadcount: Array<{
    department: string | null;
    currentHeadcount: number;
    staffRecordCount: number;
  }>;
  teacherAssignmentCoverage: Array<{
    staffId: string;
    staffCode: string | null;
    firstName: string | null;
    lastName: string | null;
    employmentStatus: string;
    linked: boolean;
    assignmentCount: number;
    sectionCount: number;
    subjectCount: number;
    coverageStatus: string;
    requiresAttention: boolean;
    assignments: Array<{
      assignmentId: string;
      academicYearId: string;
      academicYearNameI18n: Record<string, string> | null;
      sectionId: string;
      sectionCode: string | null;
      sectionNameI18n: Record<string, string> | null;
      subjectId: string;
      subjectCode: string | null;
      subjectNameI18n: Record<string, string> | null;
    }>;
  }>;  credentialAlerts: Array<{
    documentId: string;
    staffId: string;
    staffCode: string | null;
    firstName: string | null;
    lastName: string | null;
    documentType: string;
    displayName: string;
    expiresOn: string;
    expiryStatus: "EXPIRED" | "EXPIRING_SOON";
  }>;
  leaveQueue: Array<{
    leaveRequestId: string;
    staffId: string;
    staffCode: string | null;
    firstName: string | null;
    lastName: string | null;
    leaveType: string;
    status: string;
    startDate: string;
    endDate: string;
  }>;
};

const COPY = {
  fr: {
    back: "Retour au personnel",
    loading: "Chargement du rapport…",
    window: "Fenêtre d’expiration",
    days: "jours",
    export: "Exporter CSV",
    generated: "Généré",
    staff: "Personnel total",
    unlinked: "Comptes non liés",
    payroll: "Profils de paie manquants",
    assignments: "Enseignants sans affectation",
    expired: "Qualifications expirées",
    expiring: "Qualifications à renouveler",
    pendingLeave: "Congés en attente",
    payrollReady: "Prêts pour la paie",
    payrollBlocked: "Paie à corriger",
    accessIssues: "Anomalies d’accès",
    payrollEligibility: "Admissibilité à la paie",
    accessReconciliation: "Rapprochement des accès",
    currentHeadcount: "Effectif actuel",
    teachersAssigned: "Enseignants affectés",
    teacherCoverageIssues: "Affectations à corriger",
    departmentHeadcount: "Effectif par département",
    teacherCoverage: "Couverture des affectations enseignantes",
    noItems: "Aucun dossier.",
    status: "Répartition par statut",
    category: "Répartition par catégorie",
    credentials: "Alertes de qualifications",
    leave: "File des congés",
    none: "Aucune alerte.",
    open: "Ouvrir le dossier",
  },
  en: {
    back: "Back to staff",
    loading: "Loading report…",
    window: "Expiry window",
    days: "days",
    export: "Export CSV",
    generated: "Generated",
    staff: "Total staff",
    unlinked: "Unlinked accounts",
    payroll: "Missing payroll profiles",
    assignments: "Teachers without assignments",
    expired: "Expired credentials",
    expiring: "Credentials to renew",
    pendingLeave: "Pending leave requests",
    payrollReady: "Payroll ready",
    payrollBlocked: "Payroll blocked",
    accessIssues: "Access issues",
    payrollEligibility: "Payroll eligibility",
    accessReconciliation: "Access reconciliation",
    currentHeadcount: "Current headcount",
    teachersAssigned: "Teachers assigned",
    teacherCoverageIssues: "Assignment issues",
    departmentHeadcount: "Headcount by department",
    teacherCoverage: "Teacher assignment coverage",
    noItems: "No records.",
    status: "By employment status",
    category: "By staff category",
    credentials: "Credential alerts",
    leave: "Leave queue",
    none: "No alerts.",
    open: "Open record",
  },
} as const;

function staffName(item: {
  firstName: string | null;
  lastName: string | null;
  staffCode: string | null;
}) {
  return (
    [item.firstName, item.lastName].filter(Boolean).join(" ") ||
    item.staffCode ||
    "—"
  );
}

const STATUS_LABELS: Record<"fr" | "en", Record<string, string>> = {
  fr: {
    READY: "Prêt",
    MISSING_PROFILE: "Profil de paie manquant",
    PROFILE_INACTIVE: "Profil de paie inactif",
    MISSING_COMPENSATION: "Rémunération manquante",
    NOT_CURRENTLY_EMPLOYED: "Hors effectif actuel",
    ALIGNED: "Conforme",
    NO_LOGIN: "Aucun accès système",
    ACCOUNT_INACTIVE: "Compte inactif",
    ACCESS_SHOULD_BE_DISABLED: "Accès à désactiver",
    ACCESS_DISABLED: "Accès désactivé",
    MISSING_ACTIVE_MEMBERSHIP: "Accès scolaire actif manquant",
    ROLE_MISMATCH: "Rôle non conforme",
    ASSIGNED: "Affecté",
    NOT_ACTIVE: "Personnel non actif",
    NO_ASSIGNMENTS: "Aucune affectation",
    ASSIGNED_NO_LOGIN: "Affecté sans accès système",
  },
  en: {
    READY: "Ready",
    MISSING_PROFILE: "Missing payroll profile",
    PROFILE_INACTIVE: "Inactive payroll profile",
    MISSING_COMPENSATION: "Missing compensation",
    NOT_CURRENTLY_EMPLOYED: "Not currently employed",
    ALIGNED: "Aligned",
    NO_LOGIN: "No system access",
    ACCOUNT_INACTIVE: "Inactive account",
    ACCESS_SHOULD_BE_DISABLED: "Access should be disabled",
    ACCESS_DISABLED: "Access disabled",
    MISSING_ACTIVE_MEMBERSHIP: "Missing active school access",
    ROLE_MISMATCH: "Role mismatch",
    ASSIGNED: "Assigned",
    NOT_ACTIVE: "Staff not active",
    NO_ASSIGNMENTS: "No assignments",
    ASSIGNED_NO_LOGIN: "Assigned without system access",
  },
};

function statusLabel(locale: "fr" | "en", status: string) {
  return STATUS_LABELS[locale][status] ?? status.replaceAll("_", " ");
}

function localizedName(
  value: Record<string, string> | null,
  locale: "fr" | "en",
  fallback: string | null,
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? fallback ?? "—";
}
export function StaffOperationalReportClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [windowDays, setWindowDays] = useState(60);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        schoolId,
        credentialWindowDays: String(windowDays),
      });
      const response = await fetch(
        `/api/staff-management/reports/operational?${query}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to load staff report.");
      }
      setReport(body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load staff report.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    if (!report) return;
    const rows: Array<Array<string | number>> = [
      ["metric", "value"],
      ["total_staff", report.totals.staff],
      ["unlinked_accounts", report.totals.unlinkedAccounts],
      ["missing_payroll_profiles", report.totals.missingPayrollProfiles],
      [
        "teachers_without_assignments",
        report.totals.teachersWithoutAssignments,
      ],
      ["expired_credentials", report.totals.expiredCredentials],
      ["expiring_credentials", report.totals.expiringCredentials],
      ["pending_leave_requests", report.totals.pendingLeaveRequests],
      ["payroll_ready", report.totals.payrollReady],
      ["payroll_blocked", report.totals.payrollBlocked],
      ["access_issues", report.totals.accessIssues],
      ["current_headcount", report.totals.currentHeadcount],
      ["teachers_assigned", report.totals.teachersAssigned],
      ["teacher_coverage_issues", report.totals.teacherCoverageIssues],
      [],
      [
        "payroll_staff",
        "employment_status",
        "eligibility_status",
        "currency",
        "pay_frequency",
        "effective_from",
      ],
      ...report.payrollEligibility.map((item) => [
        staffName(item),
        item.employmentStatus,
        item.eligibilityStatus,
        item.currencyCode ?? "",
        item.payFrequency ?? "",
        item.compensationEffectiveFrom ?? "",
      ]),
      [],
      [
        "access_staff",
        "employment_status",
        "access_status",
        "active_roles",
        "account_status",
        "active_sessions",
      ],
      ...report.accessReconciliation.map((item) => [
        staffName(item),
        item.employmentStatus,
        item.accessStatus,
        item.activeRoles.join("|"),
        item.accountStatus ?? "",
        item.activeSessionCount,
      ]),
      [],
      ["department", "current_headcount", "staff_record_count"],
      ...report.departmentHeadcount.map((item) => [
        item.department ?? (locale === "fr" ? "Non précisé" : "Unspecified"),
        item.currentHeadcount,
        item.staffRecordCount,
      ]),
      [],
      [
        "teacher",
        "coverage_status",
        "academic_year",
        "section",
        "subject",
      ],
      ...report.teacherAssignmentCoverage.flatMap((teacher) =>
        teacher.assignments.length
          ? teacher.assignments.map((assignment) => [
              staffName(teacher),
              teacher.coverageStatus,
              localizedName(
                assignment.academicYearNameI18n,
                locale,
                null,
              ),
              localizedName(
                assignment.sectionNameI18n,
                locale,
                assignment.sectionCode,
              ),
              localizedName(
                assignment.subjectNameI18n,
                locale,
                assignment.subjectCode,
              ),
            ])
          : [[staffName(teacher), teacher.coverageStatus, "", "", ""]],
      ),
      [],      ["credential_staff", "document_type", "display_name", "expires_on"],
      ...report.credentialAlerts.map((item) => [
        staffName(item),
        item.documentType,
        item.displayName,
        item.expiresOn,
      ]),
      [],
      ["leave_staff", "leave_type", "status", "start_date", "end_date"],
      ...report.leaveQueue.map((item) => [
        staffName(item),
        item.leaveType,
        item.status,
        item.startDate,
        item.endDate,
      ]),
    ];
    const csv = createSafeCsv(rows);
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `staff-operational-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const cards = report
    ? [
        [copy.staff, report.totals.staff],
        [copy.unlinked, report.totals.unlinkedAccounts],
        [copy.payroll, report.totals.missingPayrollProfiles],
        [copy.assignments, report.totals.teachersWithoutAssignments],
        [copy.expired, report.totals.expiredCredentials],
        [copy.expiring, report.totals.expiringCredentials],
        [copy.pendingLeave, report.totals.pendingLeaveRequests],
        [copy.payrollReady, report.totals.payrollReady],
        [copy.payrollBlocked, report.totals.payrollBlocked],
        [copy.accessIssues, report.totals.accessIssues],
        [copy.currentHeadcount, report.totals.currentHeadcount],
        [copy.teachersAssigned, report.totals.teachersAssigned],
        [copy.teacherCoverageIssues, report.totals.teacherCoverageIssues],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/staff" className="text-sm font-medium text-blue-700">
          ← {copy.back}
        </Link>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">
            {copy.window}{" "}
            <select
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
              className="rounded-lg border border-slate-300 px-2 py-1"
            >
              {[30, 60, 90, 180].map((days) => (
                <option key={days} value={days}>
                  {days} {copy.days}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!report}
            onClick={exportCsv}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {copy.export}
          </button>
        </div>
      </div>
      {loading ? <p className="text-sm text-slate-500">{copy.loading}</p> : null}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {report ? (
        <>
          <p className="text-xs text-slate-500">
            {copy.generated}:{" "}
            {new Intl.DateTimeFormat(locale === "fr" ? "fr-HT" : "en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(report.generatedAt))}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {label}
                </div>
                <div className="mt-2 text-3xl font-semibold text-slate-950">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Breakdown title={copy.status} values={report.statusCounts} />
            <Breakdown title={copy.category} values={report.categoryCounts} />
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {copy.departmentHeadcount}
            </h2>
            <div className="mt-4 space-y-2">
              {!report.departmentHeadcount.length ? (
                <p className="text-sm text-slate-500">{copy.noItems}</p>
              ) : null}
              {report.departmentHeadcount.map((item) => (
                <div
                  key={item.department ?? "UNSPECIFIED"}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">
                    {item.department ??
                      (locale === "fr" ? "Non précisé" : "Unspecified")}
                  </span>
                  <span className="font-semibold text-slate-950">
                    {item.currentHeadcount}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {copy.teacherCoverage}
            </h2>
            <div className="mt-4 space-y-3">
              {!report.teacherAssignmentCoverage.length ? (
                <p className="text-sm text-slate-500">{copy.noItems}</p>
              ) : null}
              {report.teacherAssignmentCoverage.map((teacher) => (
                <div
                  key={teacher.staffId}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-950">
                        {staffName(teacher)}
                      </div>
                      <div className="text-sm text-slate-600">
                        {teacher.assignmentCount} · {teacher.sectionCount} / {teacher.subjectCount}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          teacher.requiresAttention
                            ? "bg-amber-50 text-amber-700"
                            : teacher.coverageStatus === "ASSIGNED"
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {statusLabel(locale, teacher.coverageStatus)}
                      </span>
                      <Link
                        href={`/staff/${encodeURIComponent(teacher.staffId)}`}
                        className="text-sm font-medium text-blue-700"
                      >
                        {copy.open}
                      </Link>
                    </div>
                  </div>
                  {teacher.assignments.length ? (
                    <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      {teacher.assignments.map((assignment) => (
                        <div key={assignment.assignmentId}>
                          {localizedName(
                            assignment.academicYearNameI18n,
                            locale,
                            null,
                          )}
                          {" · "}
                          {localizedName(
                            assignment.sectionNameI18n,
                            locale,
                            assignment.sectionCode,
                          )}
                          {" · "}
                          {localizedName(
                            assignment.subjectNameI18n,
                            locale,
                            assignment.subjectCode,
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {copy.payrollEligibility}
            </h2>
            <div className="mt-4 space-y-3">
              {!report.payrollEligibility.length ? (
                <p className="text-sm text-slate-500">{copy.noItems}</p>
              ) : null}
              {report.payrollEligibility.map((item) => (
                <div
                  key={item.staffId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <div className="font-medium text-slate-950">
                      {staffName(item)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {[item.currencyCode, item.payFrequency,
                        item.compensationEffectiveFrom]
                        .filter(Boolean)
                        .join(" · ") || item.employmentStatus}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.eligibilityStatus === "READY"
                          ? "bg-green-50 text-green-700"
                          : item.eligibilityStatus === "NOT_CURRENTLY_EMPLOYED"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {statusLabel(locale, item.eligibilityStatus)}
                    </span>
                    <Link
                      href={`/staff/${encodeURIComponent(item.staffId)}`}
                      className="text-sm font-medium text-blue-700"
                    >
                      {copy.open}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {copy.accessReconciliation}
            </h2>
            <div className="mt-4 space-y-3">
              {!report.accessReconciliation.length ? (
                <p className="text-sm text-slate-500">{copy.noItems}</p>
              ) : null}
              {report.accessReconciliation.map((item) => (
                <div
                  key={item.staffId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <div className="font-medium text-slate-950">
                      {staffName(item)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {item.activeRoles.length
                        ? item.activeRoles.join(", ")
                        : "—"}
                      {" · Sessions: "}
                      {item.activeSessionCount}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.requiresAttention
                          ? "bg-red-50 text-red-700"
                          : item.accessStatus === "ALIGNED"
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {statusLabel(locale, item.accessStatus)}
                    </span>
                    <Link
                      href={`/staff/${encodeURIComponent(item.staffId)}`}
                      className="text-sm font-medium text-blue-700"
                    >
                      {copy.open}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {copy.credentials}
            </h2>
            <div className="mt-4 space-y-3">
              {!report.credentialAlerts.length ? (
                <p className="text-sm text-slate-500">{copy.none}</p>
              ) : null}
              {report.credentialAlerts.map((item) => (
                <div
                  key={item.documentId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <div className="font-medium text-slate-950">
                      {staffName(item)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {item.displayName} · {item.expiresOn}
                    </div>
                  </div>
                  <Link
                    href={`/staff/${encodeURIComponent(item.staffId)}`}
                    className="text-sm font-medium text-blue-700"
                  >
                    {copy.open}
                  </Link>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {copy.leave}
            </h2>
            <div className="mt-4 space-y-3">
              {!report.leaveQueue.length ? (
                <p className="text-sm text-slate-500">{copy.none}</p>
              ) : null}
              {report.leaveQueue.map((item) => (
                <div
                  key={item.leaveRequestId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <div className="font-medium text-slate-950">
                      {staffName(item)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {item.leaveType.replaceAll("_", " ")} · {item.startDate} —
                      {" "}
                      {item.endDate} · {item.status}
                    </div>
                  </div>
                  <Link
                    href={`/staff/${encodeURIComponent(item.staffId)}`}
                    className="text-sm font-medium text-blue-700"
                  >
                    {copy.open}
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  values,
}: {
  title: string;
  values: Record<string, number>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-2">
        {Object.entries(values).map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-slate-600">{label.replaceAll("_", " ")}</span>
            <span className="font-semibold text-slate-950">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
