"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ReportCardCommentsEditor } from "@/components/report-card-comments-editor";
import { ReportCardPrintTemplate } from "@/components/report-card-print-template";
import { ReportCardDetails, ReportCardLanguage } from "@/lib/report-card-types";

export function ReportCardViewClient({
  reportCardId,
  defaultLanguage = "fr",
}: {
  reportCardId: string;
  defaultLanguage?: ReportCardLanguage;
}) {
  const [data, setData] = useState<ReportCardDetails | null>(null);
  const [language, setLanguage] = useState<ReportCardLanguage>(defaultLanguage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReportCard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/report-cards/cards/${reportCardId}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load report card.");
      }

      setData(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load report card.",
      );
    } finally {
      setLoading(false);
    }
  }, [reportCardId]);

  useEffect(() => {
    void loadReportCard();
  }, [loadReportCard]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/reports"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back to Reports
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Print / Save as PDF
          </button>

          <Link
            href={`/reports/cards/${reportCardId}/print?lang=${language}`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Open Print View
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={language}
            onChange={(e) => setLanguage(e.target.value as ReportCardLanguage)}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>

          <button
            type="button"
            onClick={loadReportCard}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 print:hidden">
          Loading report card...
        </div>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <ReportCardCommentsEditor
            reportCard={data}
            onUpdated={loadReportCard}
          />

          <ReportCardPrintTemplate data={data} language={language} />
        </div>
      ) : null}
    </div>
  );
}
