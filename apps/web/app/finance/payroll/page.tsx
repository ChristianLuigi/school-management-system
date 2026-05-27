import { PayrollLiteClient } from "@/components/payroll-lite-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function PayrollPage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <PayrollLiteClient schoolId={currentSchoolId} />
    </SchoolPageShell>
  );
}
