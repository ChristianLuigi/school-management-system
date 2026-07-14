import { PlatformSchoolDetailClient } from "@/components/platform-school-detail-client";
import { PlatformPageHeader } from "@/components/platform-ui";
import { serverApiGet } from "@/lib/server-api";

type SchoolDetailResponse = {
  school: {
    id: string;
    code: string;
    name: string;
    status: string;
    management_mode: "SELF_MANAGED" | "SUPERADMIN_MANAGED" | "HYBRID_MANAGED";
    default_locale: string;
    timezone: string;
    currency_code: string;
    country_code: string;
  };
  setup: {
    levels: number;
    academicYears: number;
    gradingPeriods: number;
    gradeLevels: number;
    sections: number;
  };
  staff: {
    schoolAdmins: number;
    teachers: number;
    financeAdmins: number;
    totalStaff: number;
  };
};

export default async function PlatformSchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = await serverApiGet<SchoolDetailResponse>(`/platform/schools/${id}`);

  return (
      <div className="space-y-6">
        <PlatformPageHeader
          title={`School: ${data.school.name}`}
          description="Inspect school state, management mode, onboarding readiness, and lifecycle controls."
        />
        <PlatformSchoolDetailClient data={data} />
      </div>
  );
}
