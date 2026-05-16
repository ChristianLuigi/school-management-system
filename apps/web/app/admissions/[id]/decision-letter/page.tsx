import { AdmissionDecisionLetterClient } from "@/components/admission-decision-letter-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import { SchoolPageHeader } from "@/components/school-ui";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function AdmissionDecisionLetterPage({
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
          title="Bordereau d'admission"
          description="Imprimer ou sauvegarder le bordereau d'admission."
        />

        <AdmissionDecisionLetterClient
          schoolId={currentSchoolId}
          admissionApplicationId={id}
        />
      </div>
    </SchoolPageShell>
  );
}
