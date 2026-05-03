"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [metric, setMetric] = useState<TrendMetric>("students_created");
  const [range, setRange] = useState<TrendRange>("30d");
  const [schoolId, setSchoolId] = useState("");
  const [managementMode, setManagementMode] = useState("");
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [trendError, setTrendError] = useState("");

  useEffect(() => {
    async function loadTrend() {
      setLoadingTrend(true);
      setTrendError("");

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
        });

        const body = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(body?.message ?? "Failed to load trend data.");
        }

        setTrend(body);
      } catch (err) {
        setTrendError(
          err instanceof Error ? err.message : "Failed to load trend data.",
        );
      } finally {
        setLoadingTrend(false);
      }
    }

    void loadTrend();
  }, [metric, range, schoolId, managementMode]);

  return (
    <div className="space-y-6">
      <PlatformPanel
        title="Platform Overview"
        subtitle="Monitor school growth, onboarding progress, staffing trends, and the operating model across the platform."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <PlatformStatCard label="Total Schools" value={data.kpis.totalSchools} />
          <PlatformStatCard label="Students" value={data.kpis.totalStudents} />
          <PlatformStatCard label="Teachers" value={data.kpis.totalTeachers} />
          <PlatformStatCard
            label="Finance Admins"
            value={data.kpis.totalFinanceAdmins}
          />
          <PlatformStatCard label="In Setup" value={data.kpis.setupSchools} />
        </div>
      </PlatformPanel>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <PlatformPanel
          title={chartTitle(metric)}
          subtitle="Switch the metric and date range to explore platform movement over time."
          action={
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${
                    range === option.value
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-3">
            <select
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={metric}
              onChange={(e) => setMetric(e.target.value as TrendMetric)}
            >
              {metricOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
            >
              <option value="">All Schools</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={managementMode}
              onChange={(e) => setManagementMode(e.target.value)}
            >
              <option value="">All Management Modes</option>
              <option value="SELF_MANAGED">Self Managed</option>
              <option value="SUPERADMIN_MANAGED">Superadmin Managed</option>
              <option value="HYBRID_MANAGED">Hybrid Managed</option>
            </select>
          </div>

          <div className="mt-6 h-96">
            {loadingTrend ? (
              <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                Loading trend...
              </div>
            ) : trendError ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-700">
                {trendError}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend?.series ?? []}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    fill="url(#trendFill)"
                    strokeWidth={3}
                    name="Count"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </PlatformPanel>

        <div className="space-y-6">
          <PlatformPanel title="Schools by Status">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.schoolsByStatus}
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

          <PlatformPanel title="Quick Actions">
            <div className="grid gap-3">
              <PlatformPrimaryLinkButton href="/platform/schools/new">
                Create School
              </PlatformPrimaryLinkButton>
              <Link
                href="/platform/schools"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
              >
                Manage Schools
              </Link>
              <Link
                href="/platform/onboarding"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
              >
                Review Onboarding
              </Link>
            </div>
          </PlatformPanel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PlatformPanel title="Management Mode Distribution">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.schoolsByManagementMode}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="managementMode" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PlatformPanel>

        <PlatformPanel title="Staff Distribution by School">
          {data.staffDistribution.length === 0 ? (
            <EmptyState
              title="No staff distribution yet"
              description="Staff metrics will appear here as schools are provisioned."
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
                  <Bar dataKey="schoolAdmins" name="School Admins" stackId="a" fill="#1d4ed8" />
                  <Bar dataKey="teachers" name="Teachers" stackId="a" fill="#0f766e" />
                  <Bar dataKey="financeAdmins" name="Finance Admins" stackId="a" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </PlatformPanel>
      </div>

      <PlatformPanel
        title="Onboarding Detail"
        subtitle="Setup readiness across tracked schools."
      >
        {data.onboardingReadiness.length === 0 ? (
          <EmptyState
            title="No onboarding data yet"
            description="School setup progress will appear here after onboarding begins."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Completion</th>
                  <th className="px-4 py-3">Levels</th>
                  <th className="px-4 py-3">Years</th>
                  <th className="px-4 py-3">Periods</th>
                  <th className="px-4 py-3">Grade Levels</th>
                  <th className="px-4 py-3">Sections</th>
                </tr>
              </thead>
              <tbody>
                {data.onboardingReadiness.map((row) => (
                  <tr key={row.schoolId} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-900">{row.schoolName}</td>
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
          </div>
        )}
      </PlatformPanel>
    </div>
  );
}
