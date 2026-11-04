
import { getServerPlatformCopy } from "@/lib/i18n";
import {
  PlatformPageHeader,
  PlatformPanel,
} from "@/components/platform-ui";

function ExportButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      download
      className="inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
    >
      {label}
    </a>
  );
}

export default async function PlatformReportsPage() {
  const pt = await getServerPlatformCopy();

  return (
      <div className="space-y-6">
        <PlatformPageHeader
          title={pt("Reports & Exports")}
          description={pt("Download platform operational data for analysis, reporting, and client follow-up.")}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <PlatformPanel
            title={pt("Schools Export")}
            subtitle={pt("Download the full tenant directory with status and management mode.")}
          >
            <ExportButton
              href="/api/proxy/platform/reports/schools"
              label={pt("Download Schools CSV")}
            />
          </PlatformPanel>

          <PlatformPanel
            title={pt("Onboarding Export")}
            subtitle={pt("Download onboarding progress and setup blockers by school.")}
          >
            <ExportButton
              href="/api/proxy/platform/reports/onboarding"
              label={pt("Download Onboarding CSV")}
            />
          </PlatformPanel>

          <PlatformPanel
            title={pt("Staff Export")}
            subtitle={pt("Download school staff accounts, statuses, and roles.")}
          >
            <ExportButton
              href="/api/proxy/platform/reports/staff"
              label={pt("Download Staff CSV")}
            />
          </PlatformPanel>

          <PlatformPanel
            title={pt("Activity Export")}
            subtitle={pt("Download the platform activity log for audit and follow-up.")}
          >
            <ExportButton
              href="/api/proxy/platform/reports/activity"
              label={pt("Download Activity CSV")}
            />
          </PlatformPanel>
        </div>
      </div>
  );
}
