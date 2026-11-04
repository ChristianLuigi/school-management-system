"use client";


import { platformErrorKey } from "@/lib/i18n/platform-copy";
import { usePlatformCopy } from "@/components/use-platform-copy";
import { ListPagination, useListPage } from "@/components/list-pagination";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { platformLabel } from "@/lib/platform-presentation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  EmptyState,
  PlatformPanel,
  PlatformPrimaryLinkButton,
  PlatformStatCard,
} from "@/components/platform-ui";

type PlatformDashboardData = {
  kpis: {
    totalSchools: number;
    activeSchools: number;
    setupSchools: number;
    suspendedSchools: number;
    archivedSchools: number;
    totalStudents: number;
    totalTeachers: number;
    totalFinanceAdmins: number;
  };
  schoolsByStatus: Array<{
    status: string;
    count: number;
  }>;
  schoolsByManagementMode: Array<{
    managementMode: string;
    count: number;
  }>;
  onboardingReadiness: Array<{
    schoolId: string;
    schoolName: string;
    completionPercent: number;
    levels: number;
    academicYears: number;
    gradingPeriods: number;
    gradeLevels: number;
    sections: number;
  }>;
  staffDistribution: Array<{
    schoolId: string;
    schoolName: string;
    schoolAdmins: number;
    teachers: number;
    financeAdmins: number;
  }>;
};

type SchoolOption = {
  id: string;
  name: string;
  code: string;
  status: string;
  management_mode?: "SELF_MANAGED" | "SUPERADMIN_MANAGED" | "HYBRID_MANAGED";
};

type TrendMetric =
  | "schools_created"
  | "students_created"
  | "teachers_created"
  | "finance_admins_created";

type TrendRange = "30d" | "90d" | "12m";

type TrendResponse = {
  metric: TrendMetric;
  range: TrendRange;
  schoolId: string | null;
  managementMode: string | null;
  series: Array<{
    label: string;
    value: number;
    bucketStart: string;
  }>;
};

type Props = {
  data: PlatformDashboardData;
  schools: SchoolOption[];
};

const PIE_COLORS = ["#1d4ed8", "#334155", "#0f766e", "#7c3aed", "#f59e0b"];

const metricOptions: Array<{ value: TrendMetric; label: string }> = [
  { value: "students_created", label: "Students" },
  { value: "teachers_created", label: "Teachers" },
  { value: "finance_admins_created", label: "Finance Admins" },
  { value: "schools_created", label: "Schools" },
];

const rangeOptions: Array<{ value: TrendRange; label: string }> = [
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "12m", label: "12M" },
];

function chartTitle(metric: TrendMetric) {
  switch (metric) {
    case "students_created":
      return "Student Growth Trend";
    case "teachers_created":
      return "Teacher Provisioning Trend";
    case "finance_admins_created":
      return "Finance Admin Provisioning Trend";
    case "schools_created":
      return "School Creation Trend";
  }
}

export function PlatformDashboardClient({ data, schools }: Props) {
  const onboardingPage = useListPage(data.onboardingReadiness);
  const pt = usePlatformCopy();

  const { locale } = useI18n();
  const fr = locale === "fr";
  const [metric, setMetric] = useState<TrendMetric>("students_created");
  const [range, setRange] = useState<TrendRange>("30d");
  const [schoolId, setSchoolId] = useState("");
  const [managementMode, setManagementMode] = useState("");
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [trendError, setTrendError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadTrend() {
      setLoadingTrend(true);
      setTrendError("");
      setTrend(null);

      try {
        const params = new URLSearchParams({
          metric,
          range,
        });

        if (schoolId) {
          params.set("schoolId", schoolId);
        }

        if (managementMode) {
          params.set("managementMode", managementMode);
        }

        const res = await fetch(`/api/platform/dashboard/trends?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const body = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(body?.message ?? "Failed to load trend data.");
        }

        if (!controller.signal.aborted) setTrend(body);
      } catch {
        if (!controller.signal.aborted) setTrendError(fr ? "Impossible de charger les tendances." : "Unable to load trends.");
      } finally {
        if (!controller.signal.aborted) setLoadingTrend(false);
      }
    }

    void loadTrend();
    return () => controller.abort();
  }, [metric, range, schoolId, managementMode, fr]);

  return (
    <div className="space-y-6">
      <PlatformPanel
        title={fr ? "Vue d’ensemble" : "Overview"}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <PlatformStatCard label={fr ? "Écoles" : "Schools"} value={data.kpis.totalSchools} />
          <PlatformStatCard label={fr ? "Élèves" : "Students"} value={data.kpis.totalStudents} />
          <PlatformStatCard label={fr ? "Enseignants" : "Teachers"} value={data.kpis.totalTeachers} />
          <PlatformStatCard
            label={fr ? "Responsables financiers" : "Finance admins"}
            value={data.kpis.totalFinanceAdmins}
          />
          <PlatformStatCard label={fr ? "En configuration" : "In setup"} value={data.kpis.setupSchools} />
        </div>
      </PlatformPanel>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <PlatformPanel
          title={pt(chartTitle(metric))}
          action={
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={range === option.value}
                  onClick={() => setRange(option.value)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${
                    range === option.value
                      ? "bg-primary text-primary-foreground"
                      : "border border-input bg-surface text-foreground text-foreground hover:bg-surface-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-3">
            <select aria-label={fr ? "Indicateur" : "Metric"}
              className="rounded-xl border border-input bg-surface text-foreground px-3 py-2 text-sm"
              value={metric}
              onChange={(e) => setMetric(e.target.value as TrendMetric)}
            >
              {metricOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {fr ? ({ students_created: "Élèves", teachers_created: "Enseignants", finance_admins_created: "Responsables financiers", schools_created: "Écoles" })[option.value] : option.label}
                </option>
              ))}
            </select>

            <select aria-label={fr ? "École" : "School"}
              className="rounded-xl border border-input bg-surface text-foreground px-3 py-2 text-sm"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
            >
              <option value="">{fr ? "Toutes les écoles" : "All schools"}</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>

            <select aria-label={fr ? "Mode de gestion" : "Management mode"}
              className="rounded-xl border border-input bg-surface text-foreground px-3 py-2 text-sm"
              value={managementMode}
              onChange={(e) => setManagementMode(e.target.value)}
            >
              <option value="">{fr ? "Tous les modes" : "All management modes"}</option>
              {['SELF_MANAGED', 'SUPERADMIN_MANAGED', 'HYBRID_MANAGED'].map(value => <option key={value} value={value}>{platformLabel(value, locale)}</option>)}
            </select>
          </div>

          <div className="mt-6 h-96">
            {loadingTrend ? (
              <div className="flex h-full items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground">
                {fr ? "Chargement…" : "Loading…"}
              </div>
            ) : trendError ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-danger/40 bg-danger-subtle text-danger">
                {pt(platformErrorKey(trendError))}
              </div>
            ) : !trend?.series.length ? <EmptyState title={fr ? "Aucune donnée" : "No data"} description={fr ? "Essayez une autre période ou école." : "Try another date range or school."} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend?.series ?? []}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)' }} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)' }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    fill="url(#trendFill)"
                    strokeWidth={3}
                    name={fr ? "Nombre" : "Count"}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </PlatformPanel>

        <div className="space-y-6">
          <PlatformPanel title={pt("Schools by Status")}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.schoolsByStatus.map(row => ({ ...row, status: pt(row.status) }))}
                    dataKey="count"
                    nameKey="status"
                    outerRadius={90}
                    label
                  >
                    {data.schoolsByStatus.map((entry, index) => (
                      <Cell
                        key={entry.status}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </PlatformPanel>

          <PlatformPanel title={pt("Quick Actions")}>
            <div className="grid gap-3">
              <PlatformPrimaryLinkButton href="/platform/schools/new">{pt("Create School")}{" "}</PlatformPrimaryLinkButton>
              <Link
                href="/platform/schools"
                className="rounded-xl border border-input bg-surface text-foreground px-4 py-3 text-sm font-medium hover:bg-surface-muted"
              >{pt("Manage Schools")}{" "}</Link>
              <Link
                href="/platform/onboarding"
                className="rounded-xl border border-input bg-surface text-foreground px-4 py-3 text-sm font-medium hover:bg-surface-muted"
              >{pt("Review Onboarding")}{" "}</Link>
            </div>
          </PlatformPanel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PlatformPanel title={pt("Management Mode Distribution")}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.schoolsByManagementMode.map(row => ({ ...row, managementMode: pt(row.managementMode) }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="managementMode" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name={pt("Count")} fill="#1d4ed8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PlatformPanel>

        <PlatformPanel title={pt("Staff Distribution by School")}>
          {data.staffDistribution.length === 0 ? (
            <EmptyState
              title={pt("No staff distribution yet")}
              description={pt("Staff metrics will appear here as schools are provisioned.")}
            />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.staffDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="schoolName" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="schoolAdmins" name={pt("School Admins")} stackId="a" fill="#1d4ed8" />
                  <Bar dataKey="teachers" name={pt("Teachers")} stackId="a" fill="#0f766e" />
                  <Bar dataKey="financeAdmins" name={pt("Finance Admins")} stackId="a" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </PlatformPanel>
      </div>

      <PlatformPanel
        title={pt("Onboarding Detail")}
        subtitle={pt("Setup readiness across tracked schools.")}
      >
        {data.onboardingReadiness.length === 0 ? (
          <EmptyState
            title={pt("No onboarding data yet")}
            description={pt("School setup progress will appear here after onboarding begins.")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{pt("School")}</th>
                  <th className="px-4 py-3">{pt("Completion")}</th>
                  <th className="px-4 py-3">{pt("Levels")}</th>
                  <th className="px-4 py-3">{pt("Years")}</th>
                  <th className="px-4 py-3">{pt("Periods")}</th>
                  <th className="px-4 py-3">{pt("Grade Levels")}</th>
                  <th className="px-4 py-3">{pt("Sections")}</th>
                </tr>
              </thead>
              <tbody>
                {onboardingPage.items.map((row) => (
                  <tr key={row.schoolId} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">{row.schoolName}</td>
                    <td className="px-4 py-3">{row.completionPercent}%</td>
                    <td className="px-4 py-3">{row.levels}</td>
                    <td className="px-4 py-3">{row.academicYears}</td>
                    <td className="px-4 py-3">{row.gradingPeriods}</td>
                    <td className="px-4 py-3">{row.gradeLevels}</td>
                    <td className="px-4 py-3">{row.sections}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListPagination {...onboardingPage} />
          </div>
        )}
      </PlatformPanel>
    </div>
  );
}
