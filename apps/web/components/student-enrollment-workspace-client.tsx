"use client";

import { ArrowRight, CalendarDays, GraduationCap, History } from "lucide-react";
import { SchoolBadge } from "@/components/school-ui";
import { StudentSectionAssignmentPanelClient } from "@/components/student-section-assignment-panel-client";
import {
  StudentStatusPanelClient,
  studentStatusLabel,
  studentStatusTone,
} from "@/components/student-status-panel-client";
import { useI18n } from "@/components/i18n-provider";

type NamedEntity = {
  id: string;
  code: string | null;
  nameI18n: Record<string, string> | null;
};

export type StudentEnrollment = {
  enrollmentId: string;
  enrollmentStatus: string;
  section: NamedEntity;
  gradeLevel: NamedEntity & {
    academicDivision: string | null;
  };
  academicYear: {
    id: string;
    nameI18n: Record<string, string> | null;
    status: string;
  };
  startDate: string;
};

export type StudentEnrollmentHistoryRow = StudentEnrollment & {
  endDate: string | null;
  createdAt: string;
  updatedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
};

type StatusHistoryRow = {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  reason: string | null;
  changedByUserId: string | null;
  changedAt: string;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
  locale: "fr" | "en",
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? fallback;
}

function enrollmentLabel(
  row: StudentEnrollment,
  locale: "fr" | "en",
  unknownClassLabel: string,
) {
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

  return section.toLowerCase().includes(grade.toLowerCase())
    ? section
    : [grade, section].filter(Boolean).join(" - ") || unknownClassLabel;
}

function enrollmentTone(status: string, endedAt: string | null) {
  if (!endedAt && status === "ACTIVE") return "green" as const;
  if (status === "COMPLETED") return "green" as const;
  if (status === "TRANSFERRED") return "amber" as const;
  return "neutral" as const;
}

export function StudentEnrollmentWorkspaceClient({
  schoolId,
  studentId,
  currentStatus,
  currentEnrollment,
  enrollmentHistory,
  statusHistory,
  onUpdated,
}: {
  schoolId: string;
  studentId: string;
  currentStatus: string;
  currentEnrollment: StudentEnrollment | null;
  enrollmentHistory: StudentEnrollmentHistoryRow[];
  statusHistory: StatusHistoryRow[];
  onUpdated: () => void;
}) {
  const { locale, t } = useI18n();
  const currentLabel = currentEnrollment
    ? enrollmentLabel(
        currentEnrollment,
        locale,
        t("students.unknownClass"),
      )
    : t("students.noClassAssigned");

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <span className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("students.currentPlacement")}
              </div>
              <div className="mt-1 truncate text-xl font-bold text-slate-950">
                {currentLabel}
              </div>
              {currentEnrollment ? (
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {i18nName(
                      currentEnrollment.academicYear.nameI18n,
                      currentEnrollment.academicYear.status,
                      locale,
                    )}
                  </span>
                  <span>
                    {t("students.since", {
                      date: new Date(
                        currentEnrollment.startDate + "T00:00:00",
                      ).toLocaleDateString(
                        locale === "fr" ? "fr-HT" : "en-US",
                      ),
                    })}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <SchoolBadge tone={studentStatusTone(currentStatus)}>
            {studentStatusLabel(currentStatus, t)}
          </SchoolBadge>
        </div>
      </section>

      <StudentSectionAssignmentPanelClient
        schoolId={schoolId}
        studentId={studentId}
        currentSectionId={currentEnrollment?.section.id ?? null}
        currentSectionLabel={currentLabel}
        currentStatus={currentStatus}
        onUpdated={onUpdated}
      />

      <StudentStatusPanelClient
        schoolId={schoolId}
        studentId={studentId}
        currentStatus={currentStatus}
        hasCurrentEnrollment={Boolean(currentEnrollment)}
        statusHistory={statusHistory}
        onUpdated={onUpdated}
      />

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
              <History className="h-5 w-5" />
            </span>
            <h3 className="font-semibold text-slate-950">
              {t("students.enrollmentHistory")}
            </h3>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {enrollmentHistory.length}
          </span>
        </div>

        <div className="border-t border-slate-200 p-5">
          <div className="space-y-3">
            {enrollmentHistory.map((row) => (
              <article
                key={row.enrollmentId}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {enrollmentLabel(
                        row,
                        locale,
                        t("students.unknownClass"),
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {i18nName(
                        row.academicYear.nameI18n,
                        row.academicYear.status,
                        locale,
                      )}
                    </div>
                  </div>
                  <SchoolBadge
                    tone={enrollmentTone(row.enrollmentStatus, row.endedAt)}
                  >
                    {!row.endedAt && row.enrollmentStatus === "ACTIVE"
                      ? t("students.current")
                      : row.enrollmentStatus}
                  </SchoolBadge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <time>
                    {new Date(
                      row.startDate + "T00:00:00",
                    ).toLocaleDateString(locale === "fr" ? "fr-HT" : "en-US")}
                  </time>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <time>
                    {row.endDate
                      ? new Date(
                          row.endDate + "T00:00:00",
                        ).toLocaleDateString(
                          locale === "fr" ? "fr-HT" : "en-US",
                        )
                      : t("students.presentDate")}
                  </time>
                </div>
                {row.endReason ? (
                  <p className="mt-2 text-sm text-slate-600">{row.endReason}</p>
                ) : null}
              </article>
            ))}
            {!enrollmentHistory.length ? (
              <p className="text-sm text-slate-500">
                {t("students.noEnrollmentHistory")}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
