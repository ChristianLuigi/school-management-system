import { ReportCardBulkPrintClient } from "@/components/report-card-bulk-print-client";
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
      <div className="print:p-0">
        <ReportCardBulkPrintClient batchId={id} defaultLanguage={lang} />
      </div>
  );
}