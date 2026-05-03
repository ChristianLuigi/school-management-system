import { PlatformDashboardClient } from "@/components/platform-dashboard-client";
import { PlatformPageShell } from "@/components/platform-page-shell";
import {
  EmptyState,
  PlatformBadge,
  PlatformPageHeader,
  PlatformPanel,
  PlatformPrimaryLinkButton,
} from "@/components/platform-ui";
import { getMeContext } from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

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

type School = {
  id: string;
  code: string;
  name: string;
  status: string;
  management_mode?: "SELF_MANAGED" | "SUPERADMIN_MANAGED" | "HYBRID_MANAGED";
};

type ActivityRow = {
  id: string;
  event_type: string;
  actor_type: string;
  school_name: string | null;
  summary: string;
  created_at: string;
};

export default async function PlatformDashboardPage() {
  const context = await getMeContext();

  const [dashboard, schools, activity] = await Promise.all([
    serverApiGet<PlatformDashboardData>("/platform/dashboard/summary"),
    serverApiGet<School[]>("/platform/schools"),
    serverApiGet<ActivityRow[]>("/platform/activity?limit=6"),
  ]);

  const attentionSchools = [...dashboard.onboardingReadiness]
    .sort((a, b) => a.completionPercent - b.completionPercent)
    .filter((row) => row.completionPercent < 100)
    .slice(0, 5);

  return (
    <PlatformPageShell>
      <div className="space-y-6">
        <PlatformPageHeader
          title="Platform Dashboard"
          description="Super admin command center across all school tenants."
          action={
            <PlatformPrimaryLinkButton href="/platform/schools/new">
              Create School
            </PlatformPrimaryLinkButton>
          }
        />

        <PlatformPanel title="Logged-in User">
          <div className="text-xl font-bold text-slate-900">
            {context.user.firstName ?? ""} {context.user.lastName ?? ""}
          </div>
          <div className="mt-1 text-sm text-slate-600">{context.user.email}</div>
          <div className="mt-3">
            <PlatformBadge tone="blue">
              Platform role: {context.user.platformRole ?? "-"}
            </PlatformBadge>
          </div>
        </PlatformPanel>

        <PlatformDashboardClient data={dashboard} schools={schools} />

        <div className="grid gap-6 xl:grid-cols-2">
          <PlatformPanel
            title="Schools Needing Attention"
            subtitle="Tenants that are not yet fully operational."
            action={
              <PlatformPrimaryLinkButton href="/platform/onboarding">
                Open Onboarding
              </PlatformPrimaryLinkButton>
            }
          >
            {attentionSchools.length === 0 ? (
              <EmptyState
                title="No schools need attention"
                description="All tracked schools are currently complete."
              />
            ) : (
              <div className="space-y-3">
                {attentionSchools.map((school) => (
                  <div
                    key={school.schoolId}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-medium text-slate-900">
                        {school.schoolName}
                      </div>
                      <div className="text-sm font-semibold text-slate-700">
                        {school.completionPercent}%
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${school.completionPercent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PlatformPanel>

          <PlatformPanel
            title="Recent Activity"
            subtitle="Latest high-level actions across the platform."
            action={
              <PlatformPrimaryLinkButton href="/platform/activity">
                Open Activity
              </PlatformPrimaryLinkButton>
            }
          >
            {activity.length === 0 ? (
              <EmptyState
                title="No recent activity"
                description="Platform events will appear here as actions happen."
              />
            ) : (
              <div className="space-y-3">
                {activity.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {row.summary}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(row.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <PlatformBadge>{row.event_type}</PlatformBadge>
                      <PlatformBadge tone="neutral">{row.actor_type}</PlatformBadge>
                      {row.school_name ? (
                        <PlatformBadge tone="blue">{row.school_name}</PlatformBadge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PlatformPanel>
        </div>
      </div>
    </PlatformPageShell>
  );
}
