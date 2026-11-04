
import { getServerPlatformCopy } from "@/lib/i18n";
import { PlatformDashboardClient } from "@/components/platform-dashboard-client";
import {
  EmptyState,
  PlatformBadge,
  PlatformPageHeader,
  PlatformPanel,
  PlatformPrimaryLinkButton,
} from "@/components/platform-ui";
import { getServerTranslator } from "@/lib/i18n";
import { PlatformAuditSummary } from "@/components/platform-audit-summary";
import { PlatformValueLabel } from "@/components/platform-value-label";
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
  const pt = await getServerPlatformCopy();

  const { locale } = await getServerTranslator();
  const fr = locale === "fr";

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
    <div className="space-y-6">
      <PlatformPageHeader
        title={fr ? "Tableau de bord" : "Dashboard"}
        description={fr ? "Écoles, activité et priorités de la plateforme." : "Schools, activity and platform priorities."}
        action={
          <PlatformPrimaryLinkButton href="/platform/schools/new">
            {fr ? "Nouvelle école" : "New school"}
          </PlatformPrimaryLinkButton>
        }
      />

      <PlatformDashboardClient data={dashboard} schools={schools} />

      <div className="grid gap-6 xl:grid-cols-2">
        <PlatformPanel
          title={fr ? "Écoles à accompagner" : "Schools needing attention"}
          action={
            <PlatformPrimaryLinkButton href="/platform/onboarding">
              {fr ? "Voir le suivi" : "View onboarding"}
            </PlatformPrimaryLinkButton>
          }
        >
          {attentionSchools.length === 0 ? (
            <EmptyState
              title={pt("No schools need attention")}
              description={pt("All tracked schools are currently complete.")}
            />
          ) : (
            <div className="space-y-3">
              {attentionSchools.map((school) => (
                <div
                  key={school.schoolId}
                  className="rounded-2xl border border-border p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium text-foreground">
                      {school.schoolName}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {school.completionPercent}%
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${school.completionPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PlatformPanel>

        <PlatformPanel
          title={fr ? "Activité récente" : "Recent activity"}
          action={
            <PlatformPrimaryLinkButton href="/platform/activity">
              {fr ? "Voir l’activité" : "View activity"}
            </PlatformPrimaryLinkButton>
          }
        >
          {activity.length === 0 ? (
            <EmptyState
              title={pt("No recent activity")}
              description={pt("Platform events will appear here as actions happen.")}
            />
          ) : (
            <div className="space-y-3">
              {activity.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">
                      <PlatformAuditSummary summary={row.summary} eventType={row.event_type} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString(fr ? "fr-HT" : "en-US")}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <PlatformBadge><PlatformValueLabel value={row.event_type} /></PlatformBadge>
                    <PlatformBadge tone="neutral"><PlatformValueLabel value={row.actor_type} /></PlatformBadge>
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
  );
}
