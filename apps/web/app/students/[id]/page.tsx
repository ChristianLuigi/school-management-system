import Link from "next/link";
import { notFound } from "next/navigation";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getActiveAcademicContext,
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type Student = {
  id: string;
  school_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  admission_date: string | null;
  status: string;
};

type Enrollment = {
  id: string;
  student_id: string;
  academic_year_id: string;
  grade_level_id: string;
  section_id: string;
  enrollment_status: string;
  start_date: string;
  end_date: string | null;
  student_number: string;
  student_first_name: string;
  student_last_name: string;
  grade_level_code: string;
  grade_level_name_i18n: Record<string, string>;
  section_code: string;
  section_name_i18n: Record<string, string>;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  total_amount: string;
  balance_due: string;
};

type StudentDiscount = {
  id: string;
  name_i18n: Record<string, string>;
  discount_type: "PERCENT" | "FIXED";
  value: string;
  scope: "TUITION" | "TRANSPORT" | "ALL";
  start_date: string;
  end_date: string | null;
};

type ReportCardPreview = {
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

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const { academicYearId, gradingPeriodId } =
    await getActiveAcademicContext(schoolId);

  const students = await serverApiGet<Student[]>(
    `/students?schoolId=${schoolId}`,
  );

  const student = students.find((item) => item.id === id);

  if (!student) {
    notFound();
  }

  const [enrollmentsResult, previewResult, invoicesResult, discountsResult] =
    await Promise.allSettled([
      academicYearId
        ? serverApiGet<Enrollment[]>(
            `/enrollments?academicYearId=${academicYearId}`,
          )
        : Promise.resolve<Enrollment[]>([]),
      gradingPeriodId
        ? serverApiGet<ReportCardPreview>(
            `/report-cards/preview?studentId=${id}&gradingPeriodId=${gradingPeriodId}`,
          )
        : Promise.resolve(null),
      serverApiGet<Invoice[]>(`/invoices?studentId=${id}`),
      serverApiGet<StudentDiscount[]>(`/student-discounts?studentId=${id}`),
    ]);

  const enrollments =
    enrollmentsResult.status === "fulfilled"
      ? (enrollmentsResult.value as Enrollment[]).filter(
          (item) => item.student_id === id,
        )
      : [];

  const preview =
    previewResult.status === "fulfilled" ? previewResult.value : null;

  const invoices =
    invoicesResult.status === "fulfilled" ? invoicesResult.value : [];

  const discounts =
    discountsResult.status === "fulfilled" ? discountsResult.value : [];

  const outstanding = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.balance_due),
    0,
  );

  return (
    <SchoolPageShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">Student Detail</div>
            <h1 className="mt-1 text-3xl font-bold">
              {student.first_name} {student.last_name}
            </h1>
            <p className="mt-1 text-slate-600">
              #{student.student_number} · Status: {student.status}
            </p>
          </div>

          <Link
            href="/students"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50"
          >
            Back to Students
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Outstanding Balance</div>
            <div className="mt-2 text-2xl font-bold">{money(outstanding)}</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Invoices</div>
            <div className="mt-2 text-2xl font-bold">{invoices.length}</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Discounts</div>
            <div className="mt-2 text-2xl font-bold">{discounts.length}</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Overall Average</div>
            <div className="mt-2 text-2xl font-bold">
              {preview?.summary.overallAverage ?? "—"}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold">Profile</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <div>
                <span className="font-medium">First Name:</span>{" "}
                {student.first_name}
              </div>
              <div>
                <span className="font-medium">Last Name:</span>{" "}
                {student.last_name}
              </div>
              <div>
                <span className="font-medium">Student Number:</span>{" "}
                {student.student_number}
              </div>
              <div>
                <span className="font-medium">Date of Birth:</span>{" "}
                {student.date_of_birth ?? "—"}
              </div>
              <div>
                <span className="font-medium">Gender:</span>{" "}
                {student.gender ?? "—"}
              </div>
              <div>
                <span className="font-medium">Admission Date:</span>{" "}
                {student.admission_date ?? "—"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold">Enrollment</h2>
            <div className="mt-4 space-y-3">
              {enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="font-semibold">
                    {enrollment.grade_level_name_i18n?.fr ??
                      enrollment.grade_level_code}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Section:{" "}
                    {enrollment.section_name_i18n?.fr ??
                      enrollment.section_code}
                    {" · "}
                    Status: {enrollment.enrollment_status}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Start: {enrollment.start_date}
                    {enrollment.end_date
                      ? ` · End: ${enrollment.end_date}`
                      : ""}
                  </div>
                </div>
              ))}

              {enrollments.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No enrollment found for the current academic year.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold">Academic Snapshot</h2>

            {preview ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-slate-500">Rank</div>
                    <div className="mt-1 text-xl font-bold">
                      {preview.summary.rankInSection ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-slate-500">Coverage</div>
                    <div className="mt-1 text-xl font-bold">
                      {preview.coverage.approvedGradebooks}/
                      {preview.coverage.totalSectionSubjects}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
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

                <div
                  className={`inline-flex rounded-full px-3 py-2 text-sm font-medium ${
                    preview.coverage.isComplete
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {preview.coverage.isComplete
                    ? "Report card coverage complete"
                    : "Report card coverage incomplete"}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">
                No academic preview available yet.
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold">Discounts / Scholarships</h2>
            <div className="mt-4 space-y-3">
              {discounts.map((discount) => (
                <div
                  key={discount.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="font-semibold">
                    {discount.name_i18n?.fr ?? "Discount"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Type: {discount.discount_type} · Value: {discount.value} ·
                    Scope: {discount.scope}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Start: {discount.start_date}
                    {discount.end_date ? ` · End: ${discount.end_date}` : ""}
                  </div>
                </div>
              ))}

              {discounts.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No discounts assigned.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Invoices</h2>
          <div className="mt-4 space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="font-semibold">{invoice.invoice_number}</div>
                <div className="mt-1 text-sm text-slate-600">
                  Status: {invoice.status} · Total: {invoice.total_amount} ·
                  Balance: {invoice.balance_due}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Issue: {invoice.issue_date} · Due: {invoice.due_date}
                </div>
              </div>
            ))}

            {invoices.length === 0 ? (
              <div className="text-sm text-slate-500">No invoices found.</div>
            ) : null}
          </div>
        </div>
      </div>
    </SchoolPageShell>
  );
}
