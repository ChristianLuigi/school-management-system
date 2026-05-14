import { StudentProfileEditClient } from "@/components/student-profile-edit-client";
import { SchoolPageShell } from "@/components/school-page-shell";
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
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN"]}>
      <div className="space-y-6">
        <SchoolPageHeader
          title="Edit Student Profile"
          description="Update identity, class assignment, documents, and health information."
        />

        <StudentProfileEditClient schoolId={currentSchoolId} studentId={id} />
      </div>
    </SchoolPageShell>
  );
}
