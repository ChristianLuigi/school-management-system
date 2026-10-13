import { OfficeRecordClient } from "@/components/office-record-client";
import { redirect } from "next/navigation";
import { StudentCreateClient } from "@/components/student-create-client";
import { SchoolPageHeader } from "@/components/school-ui";
import { getServerTranslator } from "@/lib/i18n";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function NewStudentPage() {
  const context = await getMeContext();
  const { t } = await getServerTranslator();
  const roles = resolveEffectiveRoles(context);
  if (roles.includes("ADMIN_STAFF") && !roles.includes("SCHOOL_ADMIN"))
    return (
      <OfficeRecordClient
        schoolId={resolveCurrentSchoolId(context)}
        kind="student"
      />
    );

  if (!roles.includes("SCHOOL_ADMIN")) {
    redirect("/students");
  }

  return (
    <div className="space-y-6">
      <SchoolPageHeader
        title={t("students.addStudent")}
        description={t("students.create.pageDescription")}
      />
      <StudentCreateClient schoolId={resolveCurrentSchoolId(context)} />
    </div>
  );
}
