import { ReportCardViewClient } from "@/components/report-card-view-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import { SchoolPageHeader } from "@/components/school-ui";

export default async function ReportCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN"]}>
      <div className="space-y-6">
        <div className="print:hidden">
          <SchoolPageHeader
            title="Student Report Card"
            description="Review and print a generated student report card."
          />
        </div>

        <ReportCardViewClient reportCardId={id} />
      </div>
    </SchoolPageShell>
  );
}
