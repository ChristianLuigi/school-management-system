import { SchoolSwitcher } from "@/components/school-switcher";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getActiveAcademicContext,
  getMeContext,
  resolveCurrentSchoolId,
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

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function SchoolDashboardPage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  let summary: DashboardSummary | null = null;

  if (currentSchoolId) {
    const { gradingPeriodId } = await getActiveAcademicContext(currentSchoolId);

    if (gradingPeriodId) {
      summary = await serverApiGet<DashboardSummary>(
        `/dashboard/summary?schoolId=${currentSchoolId}&gradingPeriodId=${gradingPeriodId}`,
      );
    }
  }

  return (
    <SchoolPageShell
      headerExtra={
        context.availableSchools?.length ? (
          <SchoolSwitcher
            schools={context.availableSchools}
            currentSchoolId={currentSchoolId}
          />
        ) : null
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">School Dashboard</h1>
          <p className="mt-1 text-slate-600">
            Operational overview for the active school.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="text-sm text-slate-500">Current Roles</div>
          <div className="mt-2 text-lg font-semibold">
            {context.currentRoles?.join(", ") || "-"}
          </div>
        </div>

        {summary ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Students</div>
                <div className="mt-2 text-3xl font-bold">
                  {summary.metrics.totalStudents}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Teachers</div>
                <div className="mt-2 text-3xl font-bold">
                  {summary.metrics.activeTeachers}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Invoices</div>
                <div className="mt-2 text-3xl font-bold">
                  {summary.metrics.totalInvoices}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Outstanding</div>
                <div className="mt-2 text-3xl font-bold">
                  {money(summary.metrics.totalOutstanding)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Overdue</div>
                <div className="mt-2 text-3xl font-bold">
                  {summary.metrics.overdueInvoices}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </SchoolPageShell>
  );
}