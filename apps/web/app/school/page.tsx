import { SchoolPageShell } from "@/components/school-page-shell";
import {
  EmptySchoolState,
  QuickLinkCard,
  SchoolBadge,
  SchoolPageHeader,
  SchoolPanel,
  SchoolStatCard,
} from "@/components/school-ui";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type DashboardSummary = {
  schoolId: string;
  gradingPeriodId: string;
  gradingPeriodNameI18n: Record<string, string>;
  metrics: {
    totalStudents: number;
    activeTeachers: number;
    totalInvoices: number;
    totalOutstanding: number;
    overdueInvoices: number;
  };
  gradebookCoverage: {
    totalSectionSubjects: number;
    approvedGradebooks: number;
    coveragePercent: number;
    isComplete: boolean;
  };
};

type SetupStatus = {
  school: {
    id: string;
    code: string;
    name: string;
    status: string;
  };
  counts: {
    levels: number;
    academicYears: number;
    gradingPeriods: number;
    gradeLevels: number;
    sections: number;
  };
  checks: {
    hasLevels: boolean;
    hasAcademicYear: boolean;
    hasGradingPeriods: boolean;
    hasGradeLevels: boolean;
    hasSections: boolean;
  };
  isComplete: boolean;
};

const DEFAULT_GRADING_PERIOD_ID =
  "44444444-4444-4444-8444-444444444441";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function SchoolDashboardPage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  const roles = resolveEffectiveRoles(context);
  const isSchoolAdmin = roles.includes("SCHOOL_ADMIN");
  const isTeacher = roles.includes("TEACHER");
  const isFinanceAdmin = roles.includes("FINANCE_ADMIN");

  let summary: DashboardSummary | null = null;
  let setup: SetupStatus | null = null;

  if (currentSchoolId) {
    summary = await serverApiGet<DashboardSummary>(
      `/dashboard/summary?schoolId=${currentSchoolId}&gradingPeriodId=${DEFAULT_GRADING_PERIOD_ID}`,
    ).catch(() => null);

    if (isSchoolAdmin) {
      setup = await serverApiGet<SetupStatus>(
        `/school-setup/status?schoolId=${currentSchoolId}`,
      ).catch(() => null);
    }
  }

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"]}>
      <div className="space-y-6">
        <SchoolPageHeader
          title="School Dashboard"
          description="Daily operational overview for the active school."
        />

        <SchoolPanel title="Current Role Context">
          <div className="flex flex-wrap gap-2">
            {roles.length > 0 ? (
              roles.map((role) => (
                <SchoolBadge
                  key={role}
                  tone={
                    role === "SCHOOL_ADMIN"
                      ? "blue"
                      : role === "TEACHER"
                        ? "green"
                        : "amber"
                  }
                >
                  {role}
                </SchoolBadge>
              ))
            ) : (
              <SchoolBadge>No active role</SchoolBadge>
            )}
          </div>
        </SchoolPanel>

        {summary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SchoolStatCard label="Students" value={summary.metrics.totalStudents} />
            <SchoolStatCard label="Teachers" value={summary.metrics.activeTeachers} />
            <SchoolStatCard label="Invoices" value={summary.metrics.totalInvoices} />
            <SchoolStatCard
              label="Outstanding"
              value={money(summary.metrics.totalOutstanding)}
            />
            <SchoolStatCard
              label="Overdue"
              value={summary.metrics.overdueInvoices}
            />
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <SchoolPanel
            title="Quick Actions"
            subtitle="Your most relevant operational entry points."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {isSchoolAdmin ? (
                <>
                  <QuickLinkCard
                    href="/students"
                    title="Manage Students"
                    description="Create, update, and review student records."
                  />
                  <QuickLinkCard
                    href="/setup"
                    title="Review Setup"
                    description="Verify academic structure and school readiness."
                  />
                  <QuickLinkCard
                    href="/attendance"
                    title="Attendance"
                    description="Monitor and manage attendance operations."
                  />
                  <QuickLinkCard
                    href="/gradebooks"
                    title="Gradebooks"
                    description="Review grade entry, readiness, and approvals."
                  />
                  <QuickLinkCard
                    href="/finance"
                    title="Finance"
                    description="Track billing, invoices, and payment follow-up."
                  />
                  <QuickLinkCard
                    href="/reports"
                    title="Reports"
                    description="Access operational and academic reporting."
                  />
                </>
              ) : null}

              {isTeacher ? (
                <>
                  <QuickLinkCard
                    href="/attendance"
                    title="Take Attendance"
                    description="Record attendance quickly for the active class."
                  />
                  <QuickLinkCard
                    href="/gradebooks"
                    title="Manage Gradebooks"
                    description="Create assessments, enter scores, and submit gradebooks."
                  />
                  <QuickLinkCard
                    href="/academics"
                    title="Academics"
                    description="Review academic structure and subject assignments."
                  />
                </>
              ) : null}

              {isFinanceAdmin ? (
                <>
                  <QuickLinkCard
                    href="/finance"
                    title="Finance Workspace"
                    description="Manage invoices, balances, and collection follow-up."
                  />
                  <QuickLinkCard
                    href="/reports"
                    title="Financial Reports"
                    description="Review school financial summaries and reporting."
                  />
                </>
              ) : null}
            </div>
          </SchoolPanel>

          <SchoolPanel
            title="Operational Attention"
            subtitle="Things that may need action soon."
          >
            <div className="space-y-4">
              {setup && !setup.isComplete && isSchoolAdmin ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="font-semibold text-amber-900">
                    School setup is not complete
                  </div>
                  <p className="mt-1 text-sm text-amber-800">
                    Review levels, academic year, periods, grade levels, and sections.
                  </p>
                </div>
              ) : null}

              {summary && !summary.gradebookCoverage.isComplete && (isSchoolAdmin || isTeacher) ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="font-semibold text-amber-900">
                    Gradebook coverage is incomplete
                  </div>
                  <p className="mt-1 text-sm text-amber-800">
                    Approved gradebooks: {summary.gradebookCoverage.approvedGradebooks} /{" "}
                    {summary.gradebookCoverage.totalSectionSubjects}
                  </p>
                </div>
              ) : null}

              {summary && summary.metrics.overdueInvoices > 0 && (isSchoolAdmin || isFinanceAdmin) ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="font-semibold text-red-900">
                    Overdue invoices need review
                  </div>
                  <p className="mt-1 text-sm text-red-800">
                    {summary.metrics.overdueInvoices} invoice(s) are overdue.
                  </p>
                </div>
              ) : null}

              {((isSchoolAdmin && setup?.isComplete) || !isSchoolAdmin) && summary?.gradebookCoverage.isComplete && (!isFinanceAdmin || summary.metrics.overdueInvoices === 0) ? (
                <EmptySchoolState
                  title="No immediate issues"
                  description="The current school context looks operationally healthy."
                />
              ) : null}
            </div>
          </SchoolPanel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <SchoolPanel
            title="Gradebook Coverage"
            subtitle="Current academic publishing readiness."
          >
            {summary ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <SchoolBadge tone={summary.gradebookCoverage.isComplete ? "green" : "amber"}>
                    {summary.gradebookCoverage.isComplete ? "Complete" : "Incomplete"}
                  </SchoolBadge>
                  <SchoolBadge>
                    {summary.gradebookCoverage.approvedGradebooks} /{" "}
                    {summary.gradebookCoverage.totalSectionSubjects} approved
                  </SchoolBadge>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>{summary.gradingPeriodNameI18n?.fr ?? "Coverage"}</span>
                    <span>{summary.gradebookCoverage.coveragePercent}%</span>
                  </div>

                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{
                        width: `${summary.gradebookCoverage.coveragePercent}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <EmptySchoolState
                title="No gradebook data"
                description="Gradebook coverage will appear here once the school is active."
              />
            )}
          </SchoolPanel>

          {isSchoolAdmin ? (
            <SchoolPanel
              title="Setup Readiness"
              subtitle="Current school structural readiness."
            >
              {setup ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <SchoolStatCard label="Levels" value={setup.counts.levels} />
                  <SchoolStatCard
                    label="Academic Years"
                    value={setup.counts.academicYears}
                  />
                  <SchoolStatCard
                    label="Periods"
                    value={setup.counts.gradingPeriods}
                  />
                  <SchoolStatCard
                    label="Grade Levels"
                    value={setup.counts.gradeLevels}
                  />
                  <div className="sm:col-span-2">
                    <SchoolStatCard
                      label="Sections"
                      value={setup.counts.sections}
                    />
                  </div>
                </div>
              ) : (
                <EmptySchoolState
                  title="No setup data"
                  description="Setup readiness will appear here once school context is resolved."
                />
              )}
            </SchoolPanel>
          ) : null}
        </div>
      </div>
    </SchoolPageShell>
  );
}


