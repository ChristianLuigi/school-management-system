import { AdmissionRegistrationReceiptClient } from "@/components/admission-registration-receipt-client";
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
  );
}
