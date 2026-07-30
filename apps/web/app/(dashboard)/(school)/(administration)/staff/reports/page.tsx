import { StaffOperationalReportClient } from "@/components/staff-operational-report-client";
import { SchoolPageHeader } from "@/components/school-ui";
import { getServerTranslator } from "@/lib/i18n";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function StaffReportsPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const { locale } = await getServerTranslator();

  return (
    <div className="space-y-6">
      <SchoolPageHeader
        title={
          locale === "fr"
            ? "Rapport opérationnel du personnel"
            : "Staff operational report"
        }
        description={
          locale === "fr"
            ? "Suivez les accès, les profils de paie, les affectations, les qualifications et les congés."
            : "Track account linkage, payroll profiles, assignments, credentials, and leave."
        }
      />
      <StaffOperationalReportClient schoolId={schoolId} />
    </div>
  );
}
