import { StudentReportCardPrintClient } from "@/components/student-report-card-print-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import { SchoolPageHeader } from "@/components/school-ui";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function StudentReportCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "TEACHER"]}>
      <div className="space-y-6">
        <SchoolPageHeader
          title="Student Report Card"
          description="Print or save the student academic report card."
        />

        <StudentReportCardPrintClient
          schoolId={currentSchoolId}
          studentId={id}
        />
      </div>
    </SchoolPageShell>
  );
}
