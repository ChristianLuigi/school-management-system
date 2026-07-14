"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import type { Locale } from "@/lib/i18n/messages";

type Overview = {
  date: string;
  currencyCode: string;
  students: {
    active: number;
    registered: number;
  };
  admissions: {
    pending: number;
    admitted: number;
  };
  attendance: {
    sessionsToday: number;
    presentToday: number;
    absentToday: number;
  };
  finance: {
    unpaidInvoices: number;
    totalBalanceDue: number;
    paymentsToday: number;
    paymentsMonth: number;
  };
  gradebooks: {
    assessmentsCount: number;
  };
  payroll: {
    pendingItems: number;
  };
};

function localeTag(locale: Locale) {
  return locale === "fr" ? "fr-HT" : "en-US";
}

function money(value: number, currencyCode: string, locale: Locale) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

function KpiCard({
  title,
  value,
  subtitle,
  href,
  openLabel,
  tone = "slate",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  href: string;
  openLabel: string;
  tone?: "slate" | "blue" | "green" | "amber" | "red";
}) {
  const accent = {
    slate: "bg-slate-900",
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    amber: "bg-amber-500",
    red: "bg-red-600",
  }[tone];

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
      <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400 transition group-hover:text-slate-700">
        {openLabel}
      </div>
    </Link>
  );
}

export function SchoolDashboardOverviewClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const { locale, t } = useI18n();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });
      const response = await fetch(
        `/api/dashboard/school-overview?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message ?? "Failed to load the school dashboard.");
      }

      setOverview(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load the school dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const formattedDate = overview
    ? new Intl.DateTimeFormat(localeTag(locale), {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${overview.date}T00:00:00Z`))
    : null;
  const openLabel = t("common.openWorkspace");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            {t("dashboard.schoolOverview")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {formattedDate ?? t("dashboard.operationalSummary")}
          </p>
        </div>

        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? t("common.refreshing") : t("common.refresh")}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!overview && !error ? (
        <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
          {t("common.loading")}
        </div>
      ) : null}

      {overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title={t("dashboard.activeStudents")}
              value={overview.students.active}
              subtitle={`${overview.students.registered} ${t(
                "dashboard.registeredStudents",
              )}`}
              href="/students"
              tone="blue"
              openLabel={openLabel}
            />
            <KpiCard
              title={t("dashboard.pendingAdmissions")}
              value={overview.admissions.pending}
              subtitle={`${overview.admissions.admitted} ${t(
                "dashboard.admittedApplications",
              )}`}
              href="/admissions"
              tone="amber"
              openLabel={openLabel}
            />
            <KpiCard
              title={t("dashboard.attendanceToday")}
              value={overview.attendance.sessionsToday}
              subtitle={`${overview.attendance.presentToday} ${t(
                "dashboard.present",
              )} / ${overview.attendance.absentToday} ${t("dashboard.absent")}`}
              href="/attendance"
              tone={overview.attendance.absentToday > 0 ? "red" : "green"}
              openLabel={openLabel}
            />
            <KpiCard
              title={t("dashboard.unpaidInvoices")}
              value={overview.finance.unpaidInvoices}
              subtitle={`${money(
                overview.finance.totalBalanceDue,
                overview.currencyCode,
                locale,
              )} ${t("dashboard.due")}`}
              href="/finance"
              tone={overview.finance.unpaidInvoices > 0 ? "red" : "green"}
              openLabel={openLabel}
            />
            <KpiCard
              title={t("dashboard.paymentsToday")}
              value={money(
                overview.finance.paymentsToday,
                overview.currencyCode,
                locale,
              )}
              subtitle={`${money(
                overview.finance.paymentsMonth,
                overview.currencyCode,
                locale,
              )} ${t("dashboard.thisMonth")}`}
              href="/finance"
              tone="green"
              openLabel={openLabel}
            />
            <KpiCard
              title={t("dashboard.assessments")}
              value={overview.gradebooks.assessmentsCount}
              subtitle={t("dashboard.gradebookRecords")}
              href="/gradebooks"
              tone="blue"
              openLabel={openLabel}
            />
            <KpiCard
              title={t("dashboard.payrollPending")}
              value={overview.payroll.pendingItems}
              subtitle={t("dashboard.salaryItemsPending")}
              href="/finance/payroll"
              tone={overview.payroll.pendingItems > 0 ? "amber" : "green"}
              openLabel={openLabel}
            />
            <KpiCard
              title={t("dashboard.setup")}
              value={t("common.ready")}
              subtitle={t("dashboard.structureSectionsSubjects")}
              href="/academic-structure"
              openLabel={openLabel}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="font-semibold text-slate-950">
              {t("dashboard.demoFlows")}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {t("dashboard.demoFlowsDescription")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [t("dashboard.setup"), "/academic-structure"],
                [t("nav.admissions"), "/admissions"],
                [t("dashboard.studentFiles"), "/students"],
                [t("dashboard.financeReceipts"), "/finance"],
                [t("nav.attendance"), "/attendance"],
                [t("dashboard.gradebooksReports"), "/gradebooks"],
                [t("dashboard.payrollPayslips"), "/finance/payroll"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-950"
                >
                  <span className="mr-2 text-emerald-600">
                    {t("common.ready")}
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}