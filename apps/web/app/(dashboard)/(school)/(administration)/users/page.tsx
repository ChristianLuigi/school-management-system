import { UserManagementClient } from "@/components/user-management-client";
import { SchoolPageHeader } from "@/components/school-ui";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";
import { getServerTranslator } from "@/lib/i18n";
export default async function UsersPage(){const context=await getMeContext();const schoolId=resolveCurrentSchoolId(context);const {t}=await getServerTranslator();return <div className="space-y-6"><SchoolPageHeader title={t("users.management.title")} description={t("users.management.description")}/><UserManagementClient schoolId={schoolId}/></div>}