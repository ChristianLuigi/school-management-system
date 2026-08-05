import { redirect } from "next/navigation";
import { StaffSelfServiceClient } from "@/components/staff-self-service-client";
import { SchoolPageHeader } from "@/components/school-ui";
import { getServerTranslator } from "@/lib/i18n";
import {
  canSuperAdminManageSchool,
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function MyStaffProfilePage() {
  const context = await getMeContext();
  if (canSuperAdminManageSchool(context)) {
    redirect("/school");
  }
  const schoolId = resolveCurrentSchoolId(context);
  const { t } = await getServerTranslator();

  return (
    <div className="space-y-6">
      <SchoolPageHeader
        title={t("nav.myStaffProfile")}
        description={t("nav.myStaffProfileDescription")}
      />
      <StaffSelfServiceClient schoolId={schoolId} />
    </div>
  );
}
