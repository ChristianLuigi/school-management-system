import { ReportCardBulkPrintClient } from "@/components/report-card-bulk-print-client";
import { SchoolPageShell } from "@/components/school-page-shell";
import { ReportCardLanguage } from "@/lib/report-card-types";

export default async function ReportCardBatchPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const lang: ReportCardLanguage = query.lang === "en" ? "en" : "fr";

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN"]}>
      <div className="print:p-0">
        <ReportCardBulkPrintClient batchId={id} defaultLanguage={lang} />
      </div>
    </SchoolPageShell>
  );
}