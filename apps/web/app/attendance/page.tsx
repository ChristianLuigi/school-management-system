import { AttendanceWorkspaceClient } from "@/components/attendance-workspace-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getActiveAcademicContext,
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type Section = {
  id: string;
  code: string;
  name_i18n: Record<string, string>;
};

export default async function AttendancePage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const effectiveRoles = resolveEffectiveRoles(context);
  const { academicYearId } = await getActiveAcademicContext(schoolId);

  const sections = academicYearId
    ? await serverApiGet<Section[]>(
        `/academic/sections?academicYearId=${academicYearId}`,
      ).catch(() => [] as Section[])
    : [];

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "TEACHER"]}>
      <AttendanceWorkspaceClient
        currentRoles={effectiveRoles}
        schoolId={schoolId}
        userId={context.user.id}
        sections={sections}
      />
    </SchoolPageShell>
  );
}


