import { AdmissionDetailClient } from "@/components/admission-detail-client";
import { SchoolPageShell } from "@/components/school-page-shell";
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
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN", "TEACHER"]}>
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
    </SchoolPageShell>
  );
}
