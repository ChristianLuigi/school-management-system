import { AdminShell } from "@/components/admin-shell";
import { apiGet } from "@/lib/api";

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

const STUDENT_ID = "7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const GRADING_PERIOD_ID = "44444444-4444-4444-8444-444444444441";

export default async function ReportCardsPreviewPage() {
  let preview: ReportCardPreview | null = null;
  let apiError: string | null = null;

  try {
    preview = await apiGet<ReportCardPreview>(
      `/report-cards/preview?studentId=${STUDENT_ID}&gradingPeriodId=${GRADING_PERIOD_ID}`,
    );
  } catch (error) {
    apiError =
      error instanceof Error ? error.message : "Unknown API error";
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Report Card Preview</h1>
          <p className="mt-1 text-slate-600">
            Preview weighted trimester results before draft generation or publishing.
          </p>
        </div>

        {apiError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {apiError}
          </div>
        ) : null}

        {preview ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Student</div>
                <div className="mt-2 text-xl font-bold">
                  {preview.student.firstName} {preview.student.lastName}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  #{preview.student.studentNumber}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Overall Average</div>
                <div className="mt-2 text-3xl font-bold">
                  {preview.summary.overallAverage ?? "-"}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Rank in Section</div>
                <div className="mt-2 text-3xl font-bold">
                  {preview.summary.rankInSection ?? "-"}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-lg font-semibold">Academic Context</h2>
                <div className="mt-4 space-y-2 text-sm text-slate-700">
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

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-lg font-semibold">Attendance Summary</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-slate-500">Present</div>
                    <div className="mt-1 text-xl font-bold">
                      {preview.summary.attendance.present}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-slate-500">Absent</div>
                    <div className="mt-1 text-xl font-bold">
                      {preview.summary.attendance.absent}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-slate-500">Late</div>
                    <div className="mt-1 text-xl font-bold">
                      {preview.summary.attendance.late}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-slate-500">Excused</div>
                    <div className="mt-1 text-xl font-bold">
                      {preview.summary.attendance.excused}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold">Coverage Status</h2>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <div className="rounded-full bg-slate-100 px-3 py-2">
                  Total subjects: {preview.coverage.totalSectionSubjects}
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-2">
                  Approved gradebooks: {preview.coverage.approvedGradebooks}
                </div>
                <div
                  className={`rounded-full px-3 py-2 font-medium ${
                    preview.coverage.isComplete
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {preview.coverage.isComplete ? "Complete" : "Incomplete"}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold">Subject Results</h2>
              </div>

              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600">
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
                      className="border-t border-slate-200"
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
                        className="px-4 py-6 text-center text-slate-500"
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
    </AdminShell>
  );
}