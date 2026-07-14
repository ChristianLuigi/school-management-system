import { AdmissionDetailClient } from "@/components/admission-detail-client";
import { SchoolPageHeader } from "@/components/school-ui";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function AdmissionDetailPage({
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
          title="Admission Application"
          description="Review candidate details, documents, and admission status."
        />

        <AdmissionDetailClient
          schoolId={currentSchoolId}
          admissionApplicationId={id}
        />
      </div>
  );
}
