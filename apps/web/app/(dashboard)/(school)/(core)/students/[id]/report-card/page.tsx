import { StudentReportCardPrintClient } from "@/components/student-report-card-print-client";
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
  );
}
