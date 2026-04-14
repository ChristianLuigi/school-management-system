import { SchoolPageShell } from "@/components/school-page-shell";
import { GradebooksPageClient } from "@/components/gradebooks-page-client";
import {
  getActiveAcademicContext,
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type SectionSubject = {
  id: string;
  section_id: string;
  section_code: string;
  section_name_i18n: Record<string, string>;
  subject_code: string;
  subject_name_i18n: Record<string, string>;
};

type GradingPeriod = {
  id: string;
  name_i18n: Record<string, string>;
  sequence_no: number;
  is_current: boolean;
};

export default async function GradebooksPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const { academicYearId } = await getActiveAcademicContext(schoolId);

  const [sectionSubjects, gradingPeriods] = academicYearId
    ? await Promise.all([
        serverApiGet<SectionSubject[]>(
          `/section-subjects?academicYearId=${academicYearId}`,
        ).catch(() => [] as SectionSubject[]),
        serverApiGet<GradingPeriod[]>(
          `/academic/periods?academicYearId=${academicYearId}`,
        ).catch(() => [] as GradingPeriod[]),
      ])
    : [[], []];

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "TEACHER"]}>
      <GradebooksPageClient
        userId={context.user.id}
        sectionSubjects={sectionSubjects}
        gradingPeriods={gradingPeriods}
      />
    </SchoolPageShell>
  );
}
