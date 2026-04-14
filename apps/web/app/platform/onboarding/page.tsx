import { PlatformPageShell } from "@/components/platform-page-shell";
import { serverApiGet } from "@/lib/server-api";

type School = {
  id: string;
  code: string;
  name: string;
  status: string;
  default_locale: string;
  currency_code: string;
  country_code: string;
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

function CheckBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-slate-300"}`}
    />
  );
}

export default async function PlatformOnboardingPage() {
  const schools = await serverApiGet<School[]>("/platform/schools");
  const setupSchools = schools.filter((s) => s.status === "ACTIVE_SETUP");

  const statusResults = await Promise.allSettled(
    setupSchools.map((s) =>
      serverApiGet<SetupStatus>(`/school-setup/status?schoolId=${s.id}`),
    ),
  );

  const statuses = statusResults.map((result) =>
    result.status === "fulfilled" ? result.value : null,
  );

  return (
    <PlatformPageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Onboarding</h1>
          <p className="mt-1 text-slate-600">
            Schools currently in setup mode. Each must complete their academic
            structure before going live.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Total Schools</div>
            <div className="mt-2 text-3xl font-bold">{schools.length}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">In Setup</div>
            <div className="mt-2 text-3xl font-bold">{setupSchools.length}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Setup Complete</div>
            <div className="mt-2 text-3xl font-bold">
              {statuses.filter((s) => s?.isComplete).length}
            </div>
          </div>
        </div>

        {setupSchools.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
            No schools currently in setup mode.
          </div>
        ) : (
          <div className="space-y-4">
            {setupSchools.map((school, i) => {
              const status = statuses[i];

              return (
                <div
                  key={school.id}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{school.name}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        Code: {school.code} · Locale: {school.default_locale} ·
                        Currency: {school.currency_code} · Country:{" "}
                        {school.country_code}
                      </div>
                    </div>

                    {status ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          status.isComplete
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {status.isComplete ? "Setup Complete" : "Incomplete"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                        Status unavailable
                      </span>
                    )}
                  </div>

                  {status ? (
                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                      {(
                        [
                          ["Levels", status.checks.hasLevels, status.counts.levels],
                          ["Academic Year", status.checks.hasAcademicYear, status.counts.academicYears],
                          ["Grading Periods", status.checks.hasGradingPeriods, status.counts.gradingPeriods],
                          ["Grade Levels", status.checks.hasGradeLevels, status.counts.gradeLevels],
                          ["Sections", status.checks.hasSections, status.counts.sections],
                        ] as [string, boolean, number][]
                      ).map(([label, ok, count]) => (
                        <div
                          key={label}
                          className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2"
                        >
                          <CheckBadge ok={ok} />
                          <div>
                            <div className="text-xs text-slate-500">{label}</div>
                            <div className="font-semibold">{count}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PlatformPageShell>
  );
}
