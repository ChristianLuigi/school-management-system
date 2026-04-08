import { AdminShell } from "@/components/admin-shell";
import { apiGet } from "@/lib/api";

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

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const ACADEMIC_YEAR_ID = "33333333-3333-4333-8333-333333333333";

export default async function AcademicsPage() {
  const [gradeLevels, sections, sectionSubjects] = await Promise.all([
    apiGet<GradeLevel[]>(`/academic/grade-levels?schoolId=${SCHOOL_ID}`),
    apiGet<Section[]>(
      `/academic/sections?academicYearId=${ACADEMIC_YEAR_ID}`,
    ),
    apiGet<SectionSubject[]>(
      `/section-subjects?academicYearId=${ACADEMIC_YEAR_ID}`,
    ),
  ]);

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Academics</h1>
          <p className="mt-1 text-slate-600">
            Academic structure, sections, and teaching assignments.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Grade Levels</div>
            <div className="mt-2 text-3xl font-bold">
              {gradeLevels.length}
            </div>
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
          </div>
        </div>
      </div>
    </AdminShell>
  );
}