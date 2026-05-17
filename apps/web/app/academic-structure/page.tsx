import { AcademicStructureClient } from "@/components/academic-structure-client";
import { AcademicsWorkspace } from "@/components/academics-workspace";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type GradeLevel = {
  id: string;
  code: string;
  name_i18n: Record<string, string> | null;
  academic_division?: "KINDERGARTEN" | "PRIMARY" | "SECONDARY" | null;
  display_order?: number | null;
};

type SectionOption = {
  id: string;
  code: string;
  nameI18n: Record<string, string> | null;
  gradeLevelCode: string | null;
  gradeLevelNameI18n: Record<string, string> | null;
  academicDivision: "KINDERGARTEN" | "PRIMARY" | "SECONDARY" | null;
};

type AcademicOptions = {
  sections: SectionOption[];
};

export default async function AcademicStructurePage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const effectiveRoles = resolveEffectiveRoles(context);

  const [gradeLevels, options] = await Promise.all([
    serverApiGet<GradeLevel[]>(`/academic/grade-levels?schoolId=${schoolId}`),
    serverApiGet<AcademicOptions>(`/report-cards/options?schoolId=${schoolId}`),
  ]);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN"]}>
      <AcademicsWorkspace currentRoles={effectiveRoles}>
        <AcademicStructureClient
          schoolId={schoolId}
          initialGradeLevels={gradeLevels}
          initialSections={options.sections ?? []}
        />
      </AcademicsWorkspace>
    </SchoolPageShell>
  );
}
