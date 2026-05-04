"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReportCardPrintTemplate } from "@/components/report-card-print-template";
import {
  ReportCardDetails,
  ReportCardLanguage,
} from "@/lib/report-card-types";

type BatchPrintDetails = {
  batchId: string;
  schoolId: string;
  batchStatus: string;
  cards: ReportCardDetails[];
};

export function ReportCardBulkPrintClient({
  batchId,
  defaultLanguage = "fr",
}: {
  batchId: string;
  defaultLanguage?: ReportCardLanguage;
}) {
  const [data, setData] = useState<BatchPrintDetails | null>(null);
  const [language, setLanguage] = useState<ReportCardLanguage>(defaultLanguage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadBatch() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/report-cards/batches/${batchId}/print`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load report card batch.");
      }

      setData(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load report card batch.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBatch();
  }, [batchId]);

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
            Print All / Save as PDF
          </button>
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
            onClick={loadBatch}
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
          Loading report cards...
        </div>
      ) : null}

      {data ? (
        <div className="space-y-8 print:space-y-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 print:hidden">
            <div className="text-sm text-slate-500">Batch</div>
            <div className="mt-1 font-mono text-xs text-slate-700">
              {data.batchId}
            </div>
            <div className="mt-3 text-sm text-slate-600">
              {data.cards.length} report card(s) loaded for printing.
            </div>
          </div>

          {data.cards.map((card, index) => (
            <div
              key={card.id}
              className={index === 0 ? "" : "print-page-break"}
            >
              <ReportCardPrintTemplate data={card} language={language} />
            </div>
          ))}

          {data.cards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500 print:hidden">
              No report cards found in this batch.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
