import { PlatformActivityClient } from "@/components/platform-activity-client";
import { PlatformPageShell } from "@/components/platform-page-shell";
import { PlatformPageHeader } from "@/components/platform-ui";
import { serverApiGet } from "@/lib/server-api";

type School = {
  id: string;
  name: string;
  code: string;
};

export default async function PlatformActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    schoolId?: string;
    eventType?: string;
  }>;
}) {
  const params = await searchParams;
  const schools = await serverApiGet<School[]>("/platform/schools");

  return (
    <PlatformPageShell>
      <div className="space-y-6">
        <PlatformPageHeader
          title="Activity"
          description="Review recent platform events, lifecycle changes, and support actions."
        />
        <PlatformActivityClient
          schools={schools}
          initialSchoolId={params.schoolId ?? ""}
          initialEventType={params.eventType ?? ""}
        />
      </div>
    </PlatformPageShell>
  );
}
