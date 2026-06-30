"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

function money(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

function KpiCard({
  title,
  value,
  subtitle,
  href,
  tone = "slate",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  href: string;
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
        Open workspace</div>
    </Link>
  );
}

export function SchoolDashboardOverviewClient({
  schoolId,
}: {
  schoolId: string;
}) {
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
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${overview.date}T00:00:00Z`))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            School Overview
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {formattedDate ?? "Today's operational summary"}
          </p>
        </div>

        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!overview && !error ? (
        <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
          Loading the latest school activity...
        </div>
      ) : null}

      {overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Active students"
              value={overview.students.active}
              subtitle={`${overview.students.registered} registered`}
              href="/students"
              tone="blue"
            />
            <KpiCard
              title="Pending admissions"
              value={overview.admissions.pending}
              subtitle={`${overview.admissions.admitted} admitted or confirmed`}
              href="/admissions"
              tone="amber"
            />
            <KpiCard
              title="Attendance today"
              value={overview.attendance.sessionsToday}
              subtitle={`${overview.attendance.presentToday} present / ${overview.attendance.absentToday} absent`}
              href="/attendance"
              tone={overview.attendance.absentToday > 0 ? "red" : "green"}
            />
            <KpiCard
              title="Unpaid invoices"
              value={overview.finance.unpaidInvoices}
              subtitle={`${money(overview.finance.totalBalanceDue, overview.currencyCode)} due`}
              href="/finance"
              tone={overview.finance.unpaidInvoices > 0 ? "red" : "green"}
            />
            <KpiCard
              title="Payments today"
              value={money(
                overview.finance.paymentsToday,
                overview.currencyCode,
              )}
              subtitle={`${money(overview.finance.paymentsMonth, overview.currencyCode)} this month`}
              href="/finance"
              tone="green"
            />
            <KpiCard
              title="Assessments"
              value={overview.gradebooks.assessmentsCount}
              subtitle="Gradebook activity"
              href="/gradebooks"
              tone="blue"
            />
            <KpiCard
              title="Payroll pending"
              value={overview.payroll.pendingItems}
              subtitle="Salary items awaiting payment"
              href="/finance/payroll"
              tone={overview.payroll.pendingItems > 0 ? "amber" : "green"}
            />
            <KpiCard
              title="Academic setup"
              value="Ready"
              subtitle="Structure, sections, and subjects"
              href="/academic-structure"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="font-semibold text-slate-950">Core demo flows</h3>
            <p className="mt-1 text-sm text-slate-600">
              Every major workflow is one click away from this dashboard.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Setup", "/academic-structure"],
                ["Admissions", "/admissions"],
                ["Student files", "/students"],
                ["Finance & receipts", "/finance"],
                ["Attendance", "/attendance"],
                ["Gradebooks & reports", "/gradebooks"],
                ["Payroll & payslips", "/finance/payroll"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-950"
                >
                  <span className="mr-2 text-emerald-600">Ready</span>
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
