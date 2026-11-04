
import { getServerPlatformCopy } from "@/lib/i18n";
import { PlatformStaffClient } from "@/components/platform-staff-client";
import { PlatformPageHeader } from "@/components/platform-ui";
import { serverApiGet } from "@/lib/server-api";

type School = {
  id: string;
  name: string;
  code: string;
};

export default async function PlatformStaffPage({
  searchParams,
}: {
  searchParams: Promise<{
    schoolId?: string;
    role?: string;
    status?: string;
  }>;
}) {
  const pt = await getServerPlatformCopy();

  const params = await searchParams;
  const schools = await serverApiGet<School[]>("/platform/schools");

  return (
      <div className="space-y-6">
        <PlatformPageHeader
          title={pt("Staff")}
          description={pt("Provision and manage school staff accounts across the platform.")}
        />
        <PlatformStaffClient
          schools={schools}
          initialSchoolId={params.schoolId ?? ""}
          initialRole={params.role ?? ""}
          initialStatus={params.status ?? ""}
        />
      </div>
  );
}
