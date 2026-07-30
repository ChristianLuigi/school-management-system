import { PayrollLiteClient } from "@/components/payroll-lite-client";
import {
  getMeContext,
  hasSchoolRole,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function PayrollPage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);
  const isSchoolAdmin = hasSchoolRole(context, "SCHOOL_ADMIN");

  return (
      <PayrollLiteClient schoolId={currentSchoolId} isSchoolAdmin={isSchoolAdmin} />
  );
}
