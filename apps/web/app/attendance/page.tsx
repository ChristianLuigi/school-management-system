import { AttendanceWorkspaceClient } from "@/components/attendance-workspace-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function AttendancePage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const effectiveRoles = resolveEffectiveRoles(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "TEACHER"]}>
      <AttendanceWorkspaceClient
        currentRoles={effectiveRoles}
        schoolId={schoolId}
        userId={context.user.id}
      />
    </SchoolPageShell>
  );
}


