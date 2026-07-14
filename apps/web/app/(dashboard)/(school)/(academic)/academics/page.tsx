import { AcademicsWorkspace } from "@/components/academics-workspace";
import { getServerTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/messages";
import {
  getActiveAcademicContext,
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type GradeLevel = {
  id: string;
  code: string;
  name_i18n: Record<string, string>;
};

type Section = {
  id: string;
  code: string;
  name_i18n: Record<string, string>;
};

type SectionSubject = {
  id: string;
  section_code: string;
  subject_code: string;
  subject_name_i18n: Record<string, string>;
  teacher_first_name: string;
  teacher_last_name: string;
  coefficient: string;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
  locale: Locale,
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? fallback;
}

export default async function AcademicsPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const effectiveRoles = resolveEffectiveRoles(context);
  const { academicYearId } = await getActiveAcademicContext(schoolId);
  const { locale, t } = await getServerTranslator();

  const [gradeLevels, sections, sectionSubjects] = await Promise.all([
    serverApiGet<GradeLevel[]>(`/academic/grade-levels?schoolId=${schoolId}`),
    academicYearId
      ? serverApiGet<Section[]>(
          `/academic/sections?academicYearId=${academicYearId}`,
        )
      : Promise.resolve<Section[]>([]),
    academicYearId
      ? serverApiGet<SectionSubject[]>(
          `/section-subjects?academicYearId=${academicYearId}`,
        )
      : Promise.resolve<SectionSubject[]>([]),
  ]);

  return (
    <AcademicsWorkspace currentRoles={effectiveRoles}>
      <div className="space-y-6">
        {!academicYearId ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
            {t("academic.noActiveAcademicYear")}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">
              {t("academic.gradeLevels")}
            </div>
            <div className="mt-2 text-3xl font-bold">{gradeLevels.length}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">
              {t("academic.sections")}
            </div>
            <div className="mt-2 text-3xl font-bold">{sections.length}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">
              {t("academic.sectionSubjects")}
            </div>
            <div className="mt-2 text-3xl font-bold">
              {sectionSubjects.length}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">
            {t("academic.teachingAssignments")}
          </h2>
          <div className="mt-4 space-y-3">
            {sectionSubjects.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="font-semibold">
                  {item.section_code} &middot; {item.subject_code}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {i18nName(
                    item.subject_name_i18n,
                    item.subject_code,
                    locale,
                  )}{" "}
                  &middot; {t("academic.teacher")}: {item.teacher_first_name}{" "}
                  {item.teacher_last_name} &middot; {t("academic.coefficient")}: {" "}
                  {item.coefficient}
                </div>
              </div>
            ))}
            {sectionSubjects.length === 0 && academicYearId ? (
              <div className="text-sm text-slate-500">
                {t("academic.noTeachingAssignments")}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AcademicsWorkspace>
  );
}