import { AdmissionRegistrationReceiptThermalClient } from "@/components/admission-registration-receipt-thermal-client";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function AdmissionRegistrationReceiptThermalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
      <AdmissionRegistrationReceiptThermalClient
        schoolId={currentSchoolId}
        admissionApplicationId={id}
      />
  );
}
