import { redirect } from "next/navigation";
import { StudentCreateClient } from "@/components/student-create-client";
import { SchoolPageHeader } from "@/components/school-ui";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function NewStudentPage() {
  const context = await getMeContext();
  const roles = resolveEffectiveRoles(context);

  if (!roles.includes("SCHOOL_ADMIN")) {
    redirect("/students");
  }

  return (
    <div className="space-y-6">
      <SchoolPageHeader
        title="New student"
        description="Create the student record and initial class placement."
      />
      <StudentCreateClient schoolId={resolveCurrentSchoolId(context)} />
    </div>
  );
}
