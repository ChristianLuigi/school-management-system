import {
  getActiveAcademicContext,
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type Student = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
};

type GradingPeriod = {
  id: string;
  sequence_no: number;
  name_i18n: Record<string, string>;
  is_current: boolean;
};

type ReportCardPreview = {
  student: {
    id: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
  };
  academic: {
    academicYearId: string;
    academicYearNameI18n: Record<string, string>;
    gradingPeriodId: string;
    gradingPeriodNameI18n: Record<string, string>;
    sectionId: string;
    sectionCode: string;
    sectionNameI18n: Record<string, string>;
    gradeLevelId: string;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string>;
  };
  summary: {
    overallAverage: number | null;
    rankInSection: number | null;
    attendance: {
      present: number;
      absent: number;
      late: number;
      excused: number;
    };
  };
  coverage: {
    totalSectionSubjects: number;
    approvedGradebooks: number;
    isComplete: boolean;
  };
  subjects: {
    section_subject_id: string;
    subject_code: string;
    subject_name_i18n: Record<string, string>;
    coefficient: string;
    subject_average: string;
    passing_mark: string;
  }[];
};

export default async function ReportCardsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string; gradingPeriodId?: string }>;
}) {
  const params = await searchParams;

  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const { academicYearId, gradingPeriodId: activePeriodId } =
    await getActiveAcademicContext(schoolId);

  const [students, periods] = await Promise.all([
    serverApiGet<Student[]>(`/students?schoolId=${schoolId}`),
    academicYearId
      ? serverApiGet<GradingPeriod[]>(
          `/academic/periods?academicYearId=${academicYearId}`,
        )
      : Promise.resolve<GradingPeriod[]>([]),
  ]);

  const selectedStudentId = params.studentId ?? students[0]?.id ?? null;
  const selectedPeriodId =
    params.gradingPeriodId ?? activePeriodId ?? periods[0]?.id ?? null;

  let preview: ReportCardPreview | null = null;
  let apiError: string | null = null;

  if (selectedStudentId && selectedPeriodId) {
    try {
      preview = await serverApiGet<ReportCardPreview>(
        `/report-cards/preview?studentId=${selectedStudentId}&gradingPeriodId=${selectedPeriodId}`,
      );
    } catch (error) {
      apiError =
        error instanceof Error ? error.message : "Unknown API error";
    }
  }

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Report Card Preview</h1>
          <p className="mt-1 text-muted-foreground">
            Preview weighted trimester results before draft generation or
            publishing.
          </p>
        </div>

        {/* Student + Period selectors — GET form, no JS required */}
        <form
          method="GET"
          className="flex flex-wrap gap-4 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ring"
        >
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-sm font-medium">Student</label>
            <select
              name="studentId"
              defaultValue={selectedStudentId ?? ""}
              className="w-full rounded-lg border border-input px-3 py-2 text-sm"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} (#{s.student_number})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-sm font-medium">
              Grading Period
            </label>
            <select
              name="gradingPeriodId"
              defaultValue={selectedPeriodId ?? ""}
              className="w-full rounded-lg border border-input px-3 py-2 text-sm"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_i18n?.fr ?? `Period ${p.sequence_no}`}
                  {p.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary"
            >
              Load Preview
            </button>
          </div>
        </form>

        {apiError ? (
          <div className="rounded-2xl border border-danger/40 bg-danger-subtle p-4 text-danger">
            {apiError}
          </div>
        ) : null}

        {!selectedStudentId || !selectedPeriodId ? (
          <div className="rounded-2xl border border-warning/40 bg-warning-subtle p-4 text-warning">
            No active academic year or students found. Complete school setup
            first.
          </div>
        ) : null}

        {preview ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ring">
                <div className="text-sm text-muted-foreground">Student</div>
                <div className="mt-2 text-xl font-bold">
                  {preview.student.firstName} {preview.student.lastName}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  #{preview.student.studentNumber}
                </div>
              </div>

              <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ring">
                <div className="text-sm text-muted-foreground">Overall Average</div>
                <div className="mt-2 text-3xl font-bold">
                  {preview.summary.overallAverage ?? "—"}
                </div>
              </div>

              <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ring">
                <div className="text-sm text-muted-foreground">Rank in Section</div>
                <div className="mt-2 text-3xl font-bold">
                  {preview.summary.rankInSection ?? "—"}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ring">
                <h2 className="text-lg font-semibold">Academic Context</h2>
                <div className="mt-4 space-y-2 text-sm text-foreground">
                  <div>
                    <span className="font-medium">Academic Year:</span>{" "}
                    {preview.academic.academicYearNameI18n?.fr ??
                      preview.academic.academicYearId}
                  </div>
                  <div>
                    <span className="font-medium">Trimester:</span>{" "}
                    {preview.academic.gradingPeriodNameI18n?.fr ??
                      preview.academic.gradingPeriodId}
                  </div>
                  <div>
                    <span className="font-medium">Grade Level:</span>{" "}
                    {preview.academic.gradeLevelNameI18n?.fr ??
                      preview.academic.gradeLevelCode}
                  </div>
                  <div>
                    <span className="font-medium">Section:</span>{" "}
                    {preview.academic.sectionNameI18n?.fr ??
                      preview.academic.sectionCode}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ring">
                <h2 className="text-lg font-semibold">Attendance Summary</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-surface p-3">
                    <div className="text-muted-foreground">Present</div>
                    <div className="mt-1 text-xl font-bold">
                      {preview.summary.attendance.present}
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface p-3">
                    <div className="text-muted-foreground">Absent</div>
                    <div className="mt-1 text-xl font-bold">
                      {preview.summary.attendance.absent}
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface p-3">
                    <div className="text-muted-foreground">Late</div>
                    <div className="mt-1 text-xl font-bold">
                      {preview.summary.attendance.late}
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface p-3">
                    <div className="text-muted-foreground">Excused</div>
                    <div className="mt-1 text-xl font-bold">
                      {preview.summary.attendance.excused}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ring">
              <h2 className="text-lg font-semibold">Coverage Status</h2>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <div className="rounded-full bg-surface-muted px-3 py-2">
                  Total subjects: {preview.coverage.totalSectionSubjects}
                </div>
                <div className="rounded-full bg-surface-muted px-3 py-2">
                  Approved gradebooks: {preview.coverage.approvedGradebooks}
                </div>
                <div
                  className={`rounded-full px-3 py-2 font-medium ${
                    preview.coverage.isComplete
                      ? "bg-success-subtle text-success"
                      : "bg-warning-subtle text-warning"
                  }`}
                >
                  {preview.coverage.isComplete ? "Complete" : "Incomplete"}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-ring">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-lg font-semibold">Subject Results</h2>
              </div>

              <table className="min-w-full text-sm">
                <thead className="bg-surface-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Coefficient</th>
                    <th className="px-4 py-3">Average</th>
                    <th className="px-4 py-3">Passing Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.subjects.map((subject) => (
                    <tr
                      key={subject.section_subject_id}
                      className="border-t border-border"
                    >
                      <td className="px-4 py-3">{subject.subject_code}</td>
                      <td className="px-4 py-3">
                        {subject.subject_name_i18n?.fr ?? subject.subject_code}
                      </td>
                      <td className="px-4 py-3">{subject.coefficient}</td>
                      <td className="px-4 py-3">{subject.subject_average}</td>
                      <td className="px-4 py-3">{subject.passing_mark}</td>
                    </tr>
                  ))}

                  {preview.subjects.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        No approved subject lines yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
  );
}
