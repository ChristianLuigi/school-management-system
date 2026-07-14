import { PayrollLiteClient } from "@/components/payroll-lite-client";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function PayrollPage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
      <PayrollLiteClient schoolId={currentSchoolId} />
  );
}
