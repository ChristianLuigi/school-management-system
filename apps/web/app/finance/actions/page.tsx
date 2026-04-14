import { SchoolPageShell } from "@/components/school-page-shell";
import { FinanceActionsPageClient } from "@/components/finance-actions-page-client";
import {
  getActiveAcademicContext,
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function FinanceActionsPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const { academicYearId, gradingPeriodId } =
    await getActiveAcademicContext(schoolId);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <FinanceActionsPageClient
        schoolId={schoolId}
        userId={context.user.id}
        academicYearId={academicYearId}
        gradingPeriodId={gradingPeriodId}
      />
    </SchoolPageShell>
  );
}
