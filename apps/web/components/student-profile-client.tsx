"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderOpen,
  GraduationCap,
  Hash,
  LayoutDashboard,
  Pencil,
  RefreshCw,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  admissionStatusLabel,
  admissionStatusTone,
} from "@/components/admission-status-panel-client";
import {
  StudentDocumentRecord,
  StudentDocumentsPanelClient,
} from "@/components/student-documents-panel-client";
import { StudentAttendanceHistoryPanelClient } from "@/components/student-attendance-history-panel-client";
import { StudentEnrollmentWorkspaceClient } from "@/components/student-enrollment-workspace-client";
import { StudentCreateInvoicePanelClient } from "@/components/student-create-invoice-panel-client";
import { StudentFinanceSummaryPanelClient } from "@/components/student-finance-summary-panel-client";
import { StudentProfileEditPanelClient } from "@/components/student-profile-edit-panel-client";
import { StudentGuardiansManagementPanelClient } from "@/components/student-guardians-management-panel-client";
import { StudentGuardianRow } from "@/components/student-guardians-panel-client";
import { SchoolBadge } from "@/components/school-ui";
import { useI18n } from "@/components/i18n-provider";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";
type StudentProfileTab =
  | "overview"
  | "enrollment"
  | "guardians"
  | "documents"
  | "attendance"
  | "finance";

const PROFILE_TABS = [
  { id: "overview", labelKey: "students.overview", icon: LayoutDashboard },
  { id: "enrollment", labelKey: "students.enrollment", icon: GraduationCap },
  { id: "guardians", labelKey: "students.guardians", icon: UsersRound },
  { id: "documents", labelKey: "students.documents", icon: FolderOpen },
  { id: "attendance", labelKey: "attendance.title", icon: ClipboardCheck },
  { id: "finance", labelKey: "students.finance", icon: WalletCards },
] as const;

function isStudentProfileTab(value: string | null): value is StudentProfileTab {
  return PROFILE_TABS.some((tab) => tab.id === value);
}

type StudentProfile = {
  schoolId: string;
  capabilities: {
    canViewFinance: boolean;
    canCreateInvoices: boolean;
    canRecordPayments: boolean;
  };
  student: {
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
    studentStatus: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    photoUrl: string | null;
    previousSchoolName: string | null;
    previousSchoolAddress: string | null;
    photoReceived: boolean;
    birthCertificateReceived: boolean;
    vaccinationCardReceived: boolean;
    previousSchoolRecordReceived: boolean;
    healthNotes: string | null;
    allergyNotes: string | null;
    medicalNotes: string | null;
    createdAt: string;
  };
  admissionSource: {
    id: string;
    applicationNumber: string;
    admissionStatus: string;
    firstName: string;
    lastName: string;
    createdAt: string;
  } | null;
  currentEnrollment: {
    enrollmentId: string;
    enrollmentStatus: string;
    section: {
      id: string;
      code: string | null;
      nameI18n: Record<string, string> | null;
    };
    gradeLevel: {
      id: string;
      code: string | null;
      nameI18n: Record<string, string> | null;
      academicDivision: string | null;
    };
    academicYear: {
      id: string;
      nameI18n: Record<string, string> | null;
      status: string;
    };
    startDate: string;
  } | null;
  enrollmentHistory: Array<{
    enrollmentId: string;
    enrollmentStatus: string;
    section: {
      id: string;
      code: string | null;
      nameI18n: Record<string, string> | null;
    };
    gradeLevel: {
      id: string;
      code: string | null;
      nameI18n: Record<string, string> | null;
      academicDivision: string | null;
    };
    academicYear: {
      id: string;
      nameI18n: Record<string, string> | null;
      status: string;
    };
    startDate: string;
    endDate: string | null;
    createdAt: string;
    updatedAt: string | null;
    endedAt: string | null;
    endReason: string | null;
  }>;
  statusHistory: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    reason: string | null;
    changedByUserId: string | null;
    changedAt: string;
  }>;
  documents: {
    photoReceived: boolean;
    birthCertificateReceived: boolean;
    vaccinationCardReceived: boolean;
    previousSchoolRecordReceived: boolean;
  };
  health: {
    vaccinationStatus: string | null;
    allergies: string | null;
    medicalNotes: string | null;
    specialNeeds: string | null;
  };
  documentRecords: StudentDocumentRecord[];
  guardians: StudentGuardianRow[];
  finance: {
    invoiceCount: number;
    overdueCount: number;
    totalsByCurrency: Array<{
      currencyCode: string;
      totalBilled: number;
      totalPaid: number;
      totalOutstanding: number;
    }>;
  } | null;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string | null;
    invoiceStatus: string;
    issueDate: string;
    dueDate: string | null;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    currencyCode: string;
  }>;
  recentPayments: Array<{
    id: string;
    receiptNumber: string | null;
    invoiceId: string | null;
    invoiceNumber: string | null;
    paymentStatus: string;
    paymentDate: string;
    amount: number;
    currencyCode: string;
    method: string | null;
    reference: string | null;
  }>;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
  locale: "fr" | "en",
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? fallback;
}

function studentStatusLabel(
  status: string | null,
  translate: (key: string) => string,
) {
  if (!status) return translate("students.statusPending");
  const key =
    status === "PRE_REGISTERED"
      ? "preRegistered"
      : status.toLowerCase();
  const label = translate(`students.${key}`);
  return label.startsWith("students.") ? status : label;
}

function studentStatusTone(status: string | null): BadgeTone {
  if (status === "ACTIVE" || status === "GRADUATED") return "green";
  if (status === "REGISTERED" || status === "PRE_REGISTERED") return "blue";
  if (status === "SUSPENDED") return "amber";
  if (status && ["WITHDRAWN", "TRANSFERRED", "ARCHIVED"].includes(status)) {
    return "red";
  }
  return "neutral";
}

function studentName(profile: StudentProfile, unnamedLabel: string) {
  const name = `${profile.student.firstName ?? ""} ${
    profile.student.lastName ?? ""
  }`.trim();
  return name || profile.student.studentCode || unnamedLabel;
}

function currentEnrollmentLabel(
  profile: StudentProfile,
  locale: "fr" | "en",
  noClassLabel: string,
) {
  if (!profile.currentEnrollment) return noClassLabel;

  return enrollmentLabel(profile.currentEnrollment, locale, noClassLabel);
}

function enrollmentLabel(row: {
  section: {
    code: string | null;
    nameI18n: Record<string, string> | null;
  };
  gradeLevel: {
    code: string | null;
    nameI18n: Record<string, string> | null;
  };
}, locale: "fr" | "en", unknownClassLabel: string) {
  const grade = i18nName(
    row.gradeLevel.nameI18n,
    row.gradeLevel.code ?? "",
    locale,
  );
  const section = i18nName(
    row.section.nameI18n,
    row.section.code ?? "",
    locale,
  );

  if (section.toLowerCase().includes(grade.toLowerCase())) {
    return section;
  }

  return [grade, section].filter(Boolean).join(" - ") || unknownClassLabel;
}

export function StudentProfileClient({
  schoolId,
  studentId,
}: {
  schoolId: string;
  studentId: string;
}) {
  const { locale, t } = useI18n();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [activeTab, setActiveTab] = useState<StudentProfileTab>("overview");
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/school-students/${studentId}?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? t("students.failedToLoadProfile"));
      }

      setProfile(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("students.failedToLoadProfile"),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, studentId]);
  useEffect(() => {
    const syncTabFromUrl = () => {
      const value = new URLSearchParams(window.location.search).get("tab");
      setActiveTab(isStudentProfileTab(value) ? value : "overview");
    };
    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);

  function selectTab(tab: StudentProfileTab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "overview") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const selectedTab =
    activeTab === "finance" && profile && !profile.capabilities.canViewFinance
      ? "overview"
      : activeTab;
  useEffect(() => {
    if (
      profile &&
      activeTab === "finance" &&
      !profile.capabilities.canViewFinance
    ) {
      setActiveTab("overview");
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [activeTab, profile]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/students"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("students.backToStudents")}
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/students/${studentId}/report-card`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" />
            {t("students.reportCard")}
          </Link>
          <Link
            href={`/students/${studentId}/edit`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Pencil className="h-4 w-4" />
            {t("common.edit")}
          </Link>
          <button
            type="button"
            onClick={() => void loadProfile()}
            disabled={loading}
            title={t("students.refreshProfile")}
            aria-label={t("students.refreshProfile")}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          {t("students.loadingProfile")}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {profile ? (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-wrap items-start gap-5">
                {profile.student.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.student.photoUrl}
                    alt={studentName(profile, t("students.unnamedStudent"))}
                    className="h-28 w-28 rounded-2xl border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-3xl font-bold text-slate-400">
                    {studentName(profile, t("students.unnamedStudent"))
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}

                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    {studentName(profile, t("students.unnamedStudent"))}
                  </h1>

                  <div className="mt-1 text-sm text-slate-500">
                    {profile.student.studentCode ?? t("students.codePending")}
                  </div>
                </div>
              </div>

              <SchoolBadge
                tone={studentStatusTone(profile.student.studentStatus)}
              >
                {studentStatusLabel(profile.student.studentStatus, t)}
              </SchoolBadge>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="rounded-xl bg-white p-2.5 text-blue-700 shadow-sm">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t("students.currentClass")}
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {currentEnrollmentLabel(
                      profile,
                      locale,
                      t("students.noClassAssigned"),
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="rounded-xl bg-white p-2.5 text-violet-700 shadow-sm">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t("students.created")}
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {new Date(profile.student.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="rounded-xl bg-white p-2.5 text-emerald-700 shadow-sm">
                  <Hash className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t("students.studentCode")}
                  </div>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
                    {profile.student.studentCode ?? t("students.pending")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <nav
            aria-label={t("students.profileSections")}
            className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
          >
            <div className="flex min-w-max gap-1" role="tablist">
              {PROFILE_TABS.filter(
                (tab) =>
                  tab.id !== "finance" || profile.capabilities.canViewFinance,
              ).map((tab) => {
                const Icon = tab.icon;
                const count =
                  tab.id === "enrollment"
                    ? profile.enrollmentHistory.length
                    : tab.id === "guardians"
                      ? profile.guardians.length
                      : tab.id === "documents"
                        ? profile.documentRecords.length
                        : tab.id === "finance"
                          ? (profile.finance?.invoiceCount ?? 0)
                          : null;
                const active = selectedTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    id={`student-profile-tab-${tab.id}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`student-profile-panel-${tab.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => selectTab(tab.id)}
                    onKeyDown={(event) => {
                      const tabs = Array.from(
                        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                          '[role="tab"]',
                        ) ?? [],
                      );
                      const currentIndex = tabs.indexOf(event.currentTarget);
                      let nextIndex = currentIndex;

                      if (event.key === "ArrowRight") {
                        nextIndex = (currentIndex + 1) % tabs.length;
                      } else if (event.key === "ArrowLeft") {
                        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                      } else if (event.key === "Home") {
                        nextIndex = 0;
                      } else if (event.key === "End") {
                        nextIndex = tabs.length - 1;
                      } else {
                        return;
                      }

                      event.preventDefault();
                      tabs[nextIndex]?.focus();
                      tabs[nextIndex]?.click();
                    }}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                      active
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(tab.labelKey)}</span>
                    {count !== null ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                          active
                            ? "bg-white/15 text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </nav>

          <section
            id={`student-profile-panel-${selectedTab}`}
            role="tabpanel"
            aria-labelledby={`student-profile-tab-${selectedTab}`}
            tabIndex={0}
            className="space-y-6"
          >
          {selectedTab === "overview" ? (
            <StudentProfileEditPanelClient
              schoolId={schoolId}
              profile={profile}
              onUpdated={loadProfile}
            />
          ) : null}

          {selectedTab === "enrollment" ? (
            <StudentEnrollmentWorkspaceClient
              schoolId={schoolId}
              studentId={profile.student.id}
              currentStatus={profile.student.studentStatus ?? "PRE_REGISTERED"}
              currentEnrollment={profile.currentEnrollment}
              enrollmentHistory={profile.enrollmentHistory}
              statusHistory={profile.statusHistory}
              onUpdated={loadProfile}
            />
          ) : null}

          {selectedTab === "overview" && profile.admissionSource ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-blue-950">
                    {t("students.admissionSource")}
                  </h3>

                  <p className="mt-1 text-sm text-blue-800">
                    {t("students.admissionSourceDescription")}
                  </p>

                  <div className="mt-3 text-sm text-blue-900">
                    <div>
                      {t("students.application")}:{" "}
                      <span className="font-semibold">
                        {profile.admissionSource.applicationNumber}
                      </span>
                    </div>

                    <div>
                      {t("students.candidate")}:{" "}
                      <span className="font-semibold">
                        {profile.admissionSource.firstName}{" "}
                        {profile.admissionSource.lastName}
                      </span>
                    </div>

                    <div>
                      {t("students.created")}:{" "}
                      <span className="font-semibold">
                        {new Date(
                          profile.admissionSource.createdAt,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <SchoolBadge
                    tone={admissionStatusTone(
                      profile.admissionSource.admissionStatus,
                    )}
                  >
                    {admissionStatusLabel(
                      profile.admissionSource.admissionStatus,
                    )}
                  </SchoolBadge>

                  <a
                    href={`/admissions/${profile.admissionSource.id}`}
                    className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                  >
                    {t("students.openAdmission")}
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          {selectedTab === "overview" ? (
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">
                  {t("students.identityDetails")}
                </h3>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">{t("students.gender")}</span>
                    <span className="font-medium">
                      {profile.student.gender === "MALE"
                        ? t("students.boy")
                        : profile.student.gender === "FEMALE"
                          ? t("students.girl")
                          : "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">{t("students.dateOfBirth")}</span>
                    <span className="font-medium">
                      {profile.student.dateOfBirth ?? "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">{t("students.placeOfBirth")}</span>
                    <span className="font-medium">
                      {profile.student.placeOfBirth ?? "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">{t("students.previousSchool")}</span>
                    <span className="font-medium">
                      {profile.student.previousSchoolName ?? "-"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">
                  {t("students.documents")}
                </h3>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t("students.create.photo")}</span>
                    <SchoolBadge
                      tone={profile.documents.photoReceived ? "green" : "amber"}
                    >
                      {profile.documents.photoReceived
                        ? t("students.received")
                        : t("students.missing")}
                    </SchoolBadge>
                  </div>

                  <div className="flex justify-between">
                    <span>{t("students.create.birthCertificate")}</span>
                    <SchoolBadge
                      tone={
                        profile.documents.birthCertificateReceived
                          ? "green"
                          : "amber"
                      }
                    >
                      {profile.documents.birthCertificateReceived
                        ? t("students.received")
                        : t("students.missing")}
                    </SchoolBadge>
                  </div>

                  <div className="flex justify-between">
                    <span>{t("students.create.vaccinationCard")}</span>
                    <SchoolBadge
                      tone={
                        profile.documents.vaccinationCardReceived
                          ? "green"
                          : "amber"
                      }
                    >
                      {profile.documents.vaccinationCardReceived
                        ? t("students.received")
                        : t("students.missing")}
                    </SchoolBadge>
                  </div>

                  <div className="flex justify-between">
                    <span>{t("students.create.previousSchoolRecord")}</span>
                    <SchoolBadge
                      tone={
                        profile.documents.previousSchoolRecordReceived
                          ? "green"
                          : "amber"
                      }
                    >
                      {profile.documents.previousSchoolRecordReceived
                        ? t("students.received")
                        : t("students.missing")}
                    </SchoolBadge>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">
                  {t("students.health")}
                </h3>

                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    <div className="text-slate-500">
                      {t("students.vaccinationStatus")}
                    </div>
                    <div className="font-medium">
                      {profile.health.vaccinationStatus ?? "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">
                      {t("students.allergies")}
                    </div>
                    <div className="font-medium">
                      {profile.health.allergies ?? "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">
                      {t("students.medicalNotes")}
                    </div>
                    <div className="font-medium">
                      {profile.health.medicalNotes ?? "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">
                      {t("students.specialNeeds")}
                    </div>
                    <div className="font-medium">
                      {profile.health.specialNeeds ?? "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {selectedTab === "documents" ? (
            <StudentDocumentsPanelClient
              schoolId={schoolId}
              studentId={profile.student.id}
              documents={profile.documentRecords}
              onChanged={loadProfile}
            />
          ) : null}
          {selectedTab === "guardians" ? (
            <StudentGuardiansManagementPanelClient
              schoolId={schoolId}
              studentId={profile.student.id}
              guardians={profile.guardians}
              onUpdated={loadProfile}
            />
          ) : null}

          {selectedTab === "finance" ? (
            <>
              {profile.capabilities.canCreateInvoices ? (
                <StudentCreateInvoicePanelClient
                  schoolId={schoolId}
                  studentId={profile.student.id}
                  onCreated={() => {
                    setFinanceRefreshKey((value) => value + 1);
                    loadProfile();
                  }}
                />
              ) : null}

              {profile.capabilities.canViewFinance ? (
                <StudentFinanceSummaryPanelClient
                  schoolId={schoolId}
                  studentId={profile.student.id}
                  refreshKey={financeRefreshKey}
                  canRecordPayments={profile.capabilities.canRecordPayments}
                />
              ) : null}
            </>
          ) : null}

          {selectedTab === "attendance" ? (
            <StudentAttendanceHistoryPanelClient
              schoolId={schoolId}
              studentId={profile.student.id}
            />
          ) : null}

          {selectedTab === "overview" ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">
                  {t("students.healthMedical")}
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-sm font-medium text-slate-700">
                      {t("students.healthNotes")}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {profile.student.healthNotes ?? t("students.noHealthNotes")}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-sm font-medium text-slate-700">
                      {t("students.allergies")}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {profile.student.allergyNotes ?? t("students.noAllergyNotes")}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-sm font-medium text-slate-700">
                      {t("students.medicalNotes")}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {profile.student.medicalNotes ?? t("students.noMedicalNotes")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">
                  {t("students.quickActions")}
                </h3>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/attendance"
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    {t("students.openAttendance")}
                  </Link>

                  <Link
                    href="/gradebooks"
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    {t("students.openGradebooks")}
                  </Link>
                </div>
              </div>
            </>
          ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
