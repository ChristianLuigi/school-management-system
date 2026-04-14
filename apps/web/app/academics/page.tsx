import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getActiveAcademicContext,
  getMeContext,
  resolveCurrentSchoolId,
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

export default async function AcademicsPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const { academicYearId } = await getActiveAcademicContext(schoolId);

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
    <SchoolPageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Academics</h1>
          <p className="mt-1 text-slate-600">
            Academic structure, sections, and teaching assignments.
          </p>
        </div>

        {!academicYearId ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
            No active academic year found. Complete school setup first.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Grade Levels</div>
            <div className="mt-2 text-3xl font-bold">{gradeLevels.length}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Sections</div>
            <div className="mt-2 text-3xl font-bold">{sections.length}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Section Subjects</div>
            <div className="mt-2 text-3xl font-bold">
              {sectionSubjects.length}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Teaching Assignments</h2>
          <div className="mt-4 space-y-3">
            {sectionSubjects.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="font-semibold">
                  {item.section_code} · {item.subject_code}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {item.subject_name_i18n?.fr ?? item.subject_code} · Teacher:{" "}
                  {item.teacher_first_name} {item.teacher_last_name} · Coef:{" "}
                  {item.coefficient}
                </div>
              </div>
            ))}
            {sectionSubjects.length === 0 && academicYearId ? (
              <div className="text-sm text-slate-500">
                No teaching assignments found.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </SchoolPageShell>
  );
}
