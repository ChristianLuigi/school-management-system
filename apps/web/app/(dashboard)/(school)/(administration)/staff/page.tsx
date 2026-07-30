import { StaffDirectoryClient } from "@/components/staff-directory-client";
import { SchoolPageHeader } from "@/components/school-ui";
import { getServerTranslator } from "@/lib/i18n";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function StaffPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const { locale } = await getServerTranslator();

  return (
    <div className="space-y-6">
      <SchoolPageHeader
        title={locale === "fr" ? "Gestion du personnel" : "Staff management"}
        description={
          locale === "fr"
            ? "Le dossier d’emploi officiel de chaque membre du personnel de l’école."
            : "The official employment record for every school staff member."
        }
      />
      <StaffDirectoryClient schoolId={schoolId} />
    </div>
  );
}
