import { SchoolPageShell } from "@/components/school-page-shell";
import { AttendancePageClient } from "@/components/attendance-page-client";
import {
  getActiveAcademicContext,
  getMeContext,
  resolveCurrentSchoolId,
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
  const { academicYearId } = await getActiveAcademicContext(schoolId);

  const sections = academicYearId
    ? await serverApiGet<Section[]>(
        `/academic/sections?academicYearId=${academicYearId}`,
      ).catch(() => [] as Section[])
    : [];

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "TEACHER"]}>
      <AttendancePageClient userId={context.user.id} sections={sections} />
    </SchoolPageShell>
  );
}
