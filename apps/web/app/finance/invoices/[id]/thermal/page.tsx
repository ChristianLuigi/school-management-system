import { StudentInvoiceThermalClient } from "@/components/student-invoice-thermal-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function StudentInvoiceThermalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <StudentInvoiceThermalClient
        schoolId={currentSchoolId}
        invoiceId={id}
      />
    </SchoolPageShell>
  );
}