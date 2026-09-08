import { StudentProfileEditClient } from "@/components/student-profile-edit-client";
import { SchoolPageHeader } from "@/components/school-ui";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function StudentProfileEditPage({
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
          title="Edit Student Profile"
          description="Update student identity, documents, and health information."
        />

        <StudentProfileEditClient schoolId={currentSchoolId} studentId={id} />
      </div>
  );
}
