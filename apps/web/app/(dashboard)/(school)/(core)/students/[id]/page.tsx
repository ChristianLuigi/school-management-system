import { StudentProfileClient } from "@/components/student-profile-client";
import { SchoolPageHeader } from "@/components/school-ui";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
      <div className="space-y-6">
        <SchoolPageHeader
          title="Student Profile"
          description="Review student identity, class, finance, and related records."
        />

        <StudentProfileClient schoolId={currentSchoolId} studentId={id} />
      </div>
  );
}
