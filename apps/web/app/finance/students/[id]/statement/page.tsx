import { StudentFinanceStatementClient } from "@/components/student-finance-statement-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import { SchoolPageHeader } from "@/components/school-ui";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function StudentFinanceStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <div className="space-y-6">
        <div className="print:hidden">
          <SchoolPageHeader
            title="Student Financial Statement"
            description="Review and print a student account statement."
          />
        </div>

        <StudentFinanceStatementClient
          schoolId={currentSchoolId}
          studentId={id}
        />
      </div>
    </SchoolPageShell>
  );
}
