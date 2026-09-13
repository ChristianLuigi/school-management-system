"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Academic = {
  academicYear: { nameI18n: Record<string, string> } | null;
  sections: Array<{
    id: string;
    code: string;
    nameI18n: Record<string, string> | null;
    studentCount: number;
  }>;
};
type Attendance = {
  totals: { present: number; absent: number; late: number; excused: number };
};
type Finance = {
  moneyByCurrency: Array<{
    currencyCode: string;
    totalInvoiced: number;
    totalPaid: number;
    totalBalanceDue: number;
  }>;
};

function useChartData<T>(url: string | null, refresh: number) {
  const [state, setState] = useState<{
    url: string;
    data?: T;
    error?: boolean;
  } | null>(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    // Clear the previous snapshot: a failed refresh must not look current.
    setState(null);
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Chart unavailable");
        return response.json() as Promise<T>;
      })
      .then((data) => {
        if (!controller.signal.aborted) setState({ url, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ url, error: true });
      });
    return () => controller.abort();
  }, [url, refresh]);
  return state?.url === url ? state : null;
}

function Panel({
  title,
  href,
  state,
  children,
}: {
  title: string;
  href: string;
  state: { error?: boolean } | null;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <Link
          href={href}
          title={title}
          aria-label={title}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>
      {!state ? (
        <div
          role="status"
          className="h-56 rounded-xl bg-slate-50 motion-safe:animate-pulse"
        >
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      ) : state.error ? (
        <p role="alert" className="py-16 text-center text-sm text-slate-500">
          {t("dashboard.chartUnavailable")}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

export function SchoolDashboardCharts({
  schoolId,
  date,
  allowedHrefs,
  refresh,
}: {
  schoolId: string;
  date: string;
  allowedHrefs: string[];
  refresh: number;
}) {
  const { locale, t } = useI18n();
  const params = new URLSearchParams({ schoolId });
  const academic = useChartData<Academic>(
    allowedHrefs.includes("/academics")
      ? `/api/academic/overview?${params}`
      : null,
    refresh,
  );
  const attendance = useChartData<Attendance>(
    allowedHrefs.includes("/attendance")
      ? `/api/attendance/dashboard?${new URLSearchParams({ schoolId, attendanceDate: date })}`
      : null,
    refresh,
  );
  const finance = useChartData<Finance>(
    allowedHrefs.includes("/finance")
      ? `/api/finance/dashboard?${params}`
      : null,
    refresh,
  );
  const format = (value: number) =>
    new Intl.NumberFormat(locale === "fr" ? "fr-HT" : "en-US").format(value);
  const name = (names: Record<string, string> | null, fallback: string) =>
    names?.[locale] ?? names?.fr ?? names?.en ?? fallback;
  const sections = [...(academic?.data?.sections ?? [])].sort(
    (a, b) => b.studentCount - a.studentCount || a.code.localeCompare(b.code),
  );
  const maxStudents = Math.max(
    1,
    ...sections.map((section) => section.studentCount),
  );
  const statuses = [
    { key: "present", label: t("dashboard.present"), color: "#059669" },
    { key: "absent", label: t("dashboard.absent"), color: "#e11d48" },
    { key: "late", label: t("dashboard.lateRecords"), color: "#d97706" },
    { key: "excused", label: t("dashboard.excusedRecords"), color: "#2563eb" },
  ] as const;
  const attendanceTotal = statuses.reduce(
    (sum, item) => sum + (attendance?.data?.totals[item.key] ?? 0),
    0,
  );
  let offset = 0;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      {allowedHrefs.includes("/academics") ? (
        <Panel
          title={t("dashboard.studentsBySection")}
          href="/academics"
          state={academic}
        >
          {academic?.data?.academicYear ? (
            <p className="mb-4 text-xs text-slate-500">
              {name(academic.data.academicYear.nameI18n, "")}
            </p>
          ) : null}
          {sections.length ? (
            <ul
              aria-label={t("dashboard.studentsBySection")}
              className="max-h-80 space-y-4 overflow-y-auto pr-2"
            >
              {sections.map((section) => (
                <li key={section.id}>
                  <div className="mb-1.5 flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 text-slate-600">
                      {name(section.nameI18n, section.code)}
                    </span>
                    <span className="font-semibold text-slate-950 tabular-nums">
                      {format(section.studentCount)}
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-3 overflow-hidden rounded-full bg-slate-100"
                  >
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{
                        width: `${(100 * section.studentCount) / maxStudents}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">
              {t("dashboard.noSectionData")}
            </p>
          )}
        </Panel>
      ) : null}

      {allowedHrefs.includes("/attendance") ? (
        <Panel
          title={t("dashboard.attendanceToday")}
          href="/attendance"
          state={attendance}
        >
          {attendanceTotal ? (
            <>
              <div className="flex flex-wrap items-center justify-center gap-6 py-3">
                <div className="relative h-48 w-48 shrink-0">
                  <svg
                    viewBox="0 0 120 120"
                    className="h-full w-full -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx="60"
                      cy="60"
                      r="46"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="14"
                    />
                    {statuses.map((item) => {
                      const percent =
                        (100 * (attendance?.data?.totals[item.key] ?? 0)) /
                        attendanceTotal;
                      const start = offset;
                      offset += percent;
                      return (
                        <circle
                          key={item.key}
                          cx="60"
                          cy="60"
                          r="46"
                          fill="none"
                          stroke={item.color}
                          strokeWidth="14"
                          pathLength="100"
                          strokeDasharray={`${percent} ${100 - percent}`}
                          strokeDashoffset={-start}
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-slate-950 tabular-nums">
                      {format(attendanceTotal)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {t("dashboard.records")}
                    </span>
                  </div>
                </div>
                <ul
                  aria-label={t("dashboard.attendanceToday")}
                  className="min-w-40 space-y-3"
                >
                  {statuses.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="flex-1 text-slate-600">
                        {item.label}
                      </span>
                      <strong className="ml-3 text-slate-950 tabular-nums">
                        {format(attendance?.data?.totals[item.key] ?? 0)}
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {t("dashboard.sessionRecordsNote")}
              </p>
            </>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">
              {t("dashboard.noAttendanceData")}
            </p>
          )}
        </Panel>
      ) : null}

      {allowedHrefs.includes("/finance") ? (
        <div className="lg:col-span-2">
          <Panel
            title={t("dashboard.financeSnapshot")}
            href="/finance"
            state={finance}
          >
            {finance?.data?.moneyByCurrency.length ? (
              <div className="grid gap-8 md:grid-cols-2">
                {finance.data.moneyByCurrency.map((currency) => {
                  const items = [
                    {
                      label: t("finance.totalInvoiced"),
                      value: currency.totalInvoiced,
                      color: "bg-blue-600",
                    },
                    {
                      label: t("finance.totalCollected"),
                      value: currency.totalPaid,
                      color: "bg-emerald-600",
                    },
                    {
                      label: t("finance.outstanding"),
                      value: currency.totalBalanceDue,
                      color: "bg-amber-500",
                    },
                  ];
                  const max = Math.max(
                    1,
                    ...items.map((item) => Math.abs(item.value)),
                  );
                  return (
                    <div key={currency.currencyCode}>
                      <h3 className="mb-4 text-sm font-bold text-slate-950">
                        {currency.currencyCode}
                      </h3>
                      <ul className="space-y-4">
                        {items.map((item) => (
                          <li key={item.label}>
                            <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-sm">
                              <span className="text-slate-600">
                                {item.label}
                              </span>
                              <strong className="text-slate-950 tabular-nums">
                                {new Intl.NumberFormat(
                                  locale === "fr" ? "fr-HT" : "en-US",
                                  {
                                    style: "currency",
                                    currency: currency.currencyCode,
                                  },
                                ).format(item.value)}
                              </strong>
                            </div>
                            <div
                              aria-hidden="true"
                              className="h-3 overflow-hidden rounded-full bg-slate-100"
                            >
                              <div
                                className={`h-full rounded-full ${item.color}`}
                                style={{
                                  width: `${(100 * Math.abs(item.value)) / max}%`,
                                }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-slate-500">
                {t("finance.noInvoices")}
              </p>
            )}
            {finance?.data?.moneyByCurrency.length ? (
              <p className="mt-5 text-xs text-slate-500">
                {t("dashboard.currencyScaleNote")}
              </p>
            ) : null}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
