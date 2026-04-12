import { AdminShell } from "@/components/admin-shell";
import { apiGet } from "@/lib/api";

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

type School = {
  id: string;
  code: string;
  name: string;
  default_locale: string;
  currency_code: string;
  country_code: string;
};

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const GRADING_PERIOD_ID = "44444444-4444-4444-8444-444444444441";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function DashboardPage() {
  let schools: School[] = [];
  let summary: DashboardSummary | null = null;
  let apiError: string | null = null;

  try {
    const [schoolsResult, summaryResult] = await Promise.all([
      apiGet<School[]>("/schools"),
      apiGet<DashboardSummary>(
        `/dashboard/summary?schoolId=${SCHOOL_ID}&gradingPeriodId=${GRADING_PERIOD_ID}`,
      ),
    ]);

    schools = schoolsResult;
    summary = summaryResult;
  } catch (error) {
    apiError =
      error instanceof Error ? error.message : "Unknown API error";
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-slate-600">
            Real-time operational overview for the school platform.
          </p>
        </div>

        {apiError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {apiError}
          </div>
        ) : null}

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

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-lg font-semibold">Gradebook Coverage</h2>
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="rounded-full bg-slate-100 px-3 py-2">
                      Approved: {summary.gradebookCoverage.approvedGradebooks}
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-2">
                      Total: {summary.gradebookCoverage.totalSectionSubjects}
                    </div>
                    <div
                      className={`rounded-full px-3 py-2 font-medium ${
                        summary.gradebookCoverage.isComplete
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {summary.gradebookCoverage.isComplete
                        ? "Complete"
                        : "Incomplete"}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                      <span>
                        {summary.gradingPeriodNameI18n?.fr ?? "Coverage"}
                      </span>
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
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-lg font-semibold">School Context</h2>
                <div className="mt-4 grid gap-3">
                  {schools.map((school) => (
                    <div
                      key={school.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="font-semibold">{school.name}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        Code: {school.code} · Locale: {school.default_locale} ·
                        Currency: {school.currency_code} · Country:{" "}
                        {school.country_code}
                      </div>
                    </div>
                  ))}

                  {schools.length === 0 && !apiError ? (
                    <div className="text-sm text-slate-500">
                      No schools found.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}