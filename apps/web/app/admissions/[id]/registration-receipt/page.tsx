import { AdmissionRegistrationReceiptClient } from "@/components/admission-registration-receipt-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import { SchoolPageHeader } from "@/components/school-ui";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function AdmissionRegistrationReceiptPage({
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
        <SchoolPageHeader
          title="Admission Registration Receipt"
          description="Print or save the registration fee receipt."
        />

        <AdmissionRegistrationReceiptClient
          schoolId={currentSchoolId}
          admissionApplicationId={id}
        />
      </div>
    </SchoolPageShell>
  );
}
