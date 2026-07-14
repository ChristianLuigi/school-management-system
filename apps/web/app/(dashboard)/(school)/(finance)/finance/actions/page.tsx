import { FinanceActionsWorkspaceClient } from "@/components/finance-actions-workspace-client";
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
      <FinanceActionsWorkspaceClient
        currentRoles={effectiveRoles}
        schoolId={schoolId}
        userId={context.user.id}
        academicYearId={academicYearId}
        gradingPeriodId={gradingPeriodId}
      />
  );
}
