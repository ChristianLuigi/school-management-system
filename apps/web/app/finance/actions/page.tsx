import { FinanceActionsWorkspaceClient } from "@/components/finance-actions-workspace-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getActiveAcademicContext,
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function FinanceActionsPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const effectiveRoles = resolveEffectiveRoles(context);
  const { academicYearId, gradingPeriodId } =
    await getActiveAcademicContext(schoolId);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <FinanceActionsWorkspaceClient
        currentRoles={effectiveRoles}
        schoolId={schoolId}
        userId={context.user.id}
        academicYearId={academicYearId}
        gradingPeriodId={gradingPeriodId}
      />
    </SchoolPageShell>
  );
}
