import { SchoolDashboardOverviewClient } from "@/components/school-dashboard-overview-client";
import { getServerTranslator } from "@/lib/i18n";
import { getSchoolNavigation } from "@/lib/navigation";
import {
  canSuperAdminManageSchool,
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function SchoolDashboardPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const roles = resolveEffectiveRoles(context);
  const { locale } = await getServerTranslator();
  const operatorAccess = canSuperAdminManageSchool(context);
  const allowedHrefs = getSchoolNavigation(roles, locale)
    .filter((item) => !operatorAccess || item.href !== "/my-staff-profile")
    .map((item) => item.href);

  return (
    <SchoolDashboardOverviewClient
      key={schoolId}
      schoolId={schoolId}
      allowedHrefs={allowedHrefs}
      canCreateStudent={roles.includes("SCHOOL_ADMIN")}
    />
  );
}
