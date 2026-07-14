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
      className="inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
    >
      {label}
    </a>
  );
}

export default function PlatformReportsPage() {
  return (
      <div className="space-y-6">
        <PlatformPageHeader
          title="Reports & Exports"
          description="Download platform operational data for analysis, reporting, and client follow-up."
        />

        <div className="grid gap-6 md:grid-cols-2">
          <PlatformPanel
            title="Schools Export"
            subtitle="Download the full tenant directory with status and management mode."
          >
            <ExportButton
              href="/api/proxy/platform/reports/schools"
              label="Download Schools CSV"
            />
          </PlatformPanel>

          <PlatformPanel
            title="Onboarding Export"
            subtitle="Download onboarding progress and setup blockers by school."
          >
            <ExportButton
              href="/api/proxy/platform/reports/onboarding"
              label="Download Onboarding CSV"
            />
          </PlatformPanel>

          <PlatformPanel
            title="Staff Export"
            subtitle="Download school staff accounts, statuses, and roles."
          >
            <ExportButton
              href="/api/proxy/platform/reports/staff"
              label="Download Staff CSV"
            />
          </PlatformPanel>

          <PlatformPanel
            title="Activity Export"
            subtitle="Download the platform activity log for audit and follow-up."
          >
            <ExportButton
              href="/api/proxy/platform/reports/activity"
              label="Download Activity CSV"
            />
          </PlatformPanel>
        </div>
      </div>
  );
}
