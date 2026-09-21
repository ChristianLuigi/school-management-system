import { OfficeRecordClient } from "@/components/office-record-client";
import { resolveEffectiveRoles } from "@/lib/server-context";
import { StudentProfileClient } from "@/components/student-profile-client";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);
  const roles = resolveEffectiveRoles(context);
  if (roles.includes("ADMIN_STAFF") && !roles.includes("SCHOOL_ADMIN")) return <OfficeRecordClient schoolId={currentSchoolId} kind="student" recordId={id} />;

  return <StudentProfileClient schoolId={currentSchoolId} studentId={id} />;
}
