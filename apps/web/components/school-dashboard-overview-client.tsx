"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  RefreshCw,
  TriangleAlert,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { SchoolDashboardCharts } from "@/components/school-dashboard-charts";
import { useI18n } from "@/components/i18n-provider";

type Overview = {
  date: string;
  students: { active: number; registered: number };
  admissions: { pending: number; admitted: number };
  attendance: {
    sessionsToday: number;
    presentToday: number;
    absentToday: number;
  };
  gradebooks: { assessmentsCount: number };
};

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "amber" | "green" | "slate";
}) {
  const color = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-xl p-2.5 ${color}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-slate-950 tabular-nums">
        {value}
      </div>
      <h3 className="mt-1 text-sm font-semibold text-slate-700">{label}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

export function SchoolDashboardOverviewClient({
  schoolId,
  allowedHrefs,
  canCreateStudent,
}: {
  schoolId: string;
  allowedHrefs: string[];
  canCreateStudent: boolean;
}) {
  const { locale, t } = useI18n();
  const [result, setResult] = useState<{
    schoolId: string;
    data: Overview;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // Never show the previous school's response while the next school is loading.
  const overview = result?.schoolId === schoolId ? result.data : null;
  const canOpen = (href: string) => allowedHrefs.includes(href);
  const number = (value: number) =>
    new Intl.NumberFormat(locale === "fr" ? "fr-HT" : "en-US").format(value);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({ schoolId });
        const response = await fetch(
          `/api/dashboard/school-overview?${params}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Dashboard unavailable");
        const data: Overview = await response.json();
        if (!controller.signal.aborted) setResult({ schoolId, data });
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [schoolId, refresh]);

  const day = overview ? new Date(`${overview.date}T00:00:00Z`) : null;
  const formattedDate =
    day && !Number.isNaN(day.getTime())
      ? new Intl.DateTimeFormat(locale === "fr" ? "fr-HT" : "en-US", {
          dateStyle: "long",
          timeZone: "UTC",
        }).format(day)
      : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            {t("dashboard.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("dashboard.atAGlance")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canCreateStudent ? (
            <Link
              href="/students/new"
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 ${focus}`}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {t("dashboard.addStudent")}
            </Link>
          ) : null}
          {formattedDate ? (
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <time dateTime={overview?.date}>{formattedDate}</time>
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
            title={t("common.refresh")}
            aria-label={t("common.refresh")}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            {t(overview ? "dashboard.refreshFailed" : "dashboard.loadFailed")}
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
            className={`min-h-10 rounded-lg bg-red-700 px-3 py-2 font-semibold text-white disabled:opacity-60 ${focus}`}
          >
            {t("finance.retry")}
          </button>
        </div>
      ) : null}

      <div aria-busy={loading} className="space-y-5">
        <span role="status" className="sr-only">
          {loading ? t("common.loading") : error ? "" : t("dashboard.updated")}
        </span>
        {!overview && loading ? (
          <div
            aria-hidden="true"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 motion-safe:animate-pulse"
          >
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-44 rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : null}
        {overview ? (
          <>
            <section
              aria-label={t("dashboard.schoolOverview")}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {canOpen("/students") ? (
                <Metric
                  icon={UsersRound}
                  label={t("dashboard.activeStudents")}
                  value={number(overview.students.active)}
                  detail={`${number(overview.students.registered)} ${t("dashboard.registeredStudents")}`}
                  tone="blue"
                />
              ) : null}
              {canOpen("/admissions") ? (
                <Metric
                  icon={UserPlus}
                  label={t("dashboard.pendingAdmissions")}
                  value={number(overview.admissions.pending)}
                  detail={`${number(overview.admissions.admitted)} ${t("dashboard.admittedApplications")}`}
                  tone="amber"
                />
              ) : null}
              {canOpen("/attendance") ? (
                <Metric
                  icon={ClipboardCheck}
                  label={t("dashboard.sessionsToday")}
                  value={number(overview.attendance.sessionsToday)}
                  detail={t("dashboard.attendanceRecords", {
                    present: number(overview.attendance.presentToday),
                    absent: number(overview.attendance.absentToday),
                  })}
                  tone="green"
                />
              ) : null}
              {canOpen("/gradebooks") ? (
                <Metric
                  icon={BookOpenCheck}
                  label={t("dashboard.assessments")}
                  value={number(overview.gradebooks.assessmentsCount)}
                  detail={t("dashboard.schoolTotal")}
                  tone="slate"
                />
              ) : null}
            </section>

            <SchoolDashboardCharts
              schoolId={schoolId}
              date={overview.date}
              allowedHrefs={allowedHrefs}
              refresh={refresh}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
