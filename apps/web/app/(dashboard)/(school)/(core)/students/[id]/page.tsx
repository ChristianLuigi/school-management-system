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

  return <StudentProfileClient schoolId={currentSchoolId} studentId={id} />;
}
