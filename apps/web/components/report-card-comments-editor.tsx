"use client";

import { useState } from "react";
import { ReportCardDetails } from "@/lib/report-card-types";

export function ReportCardCommentsEditor({
  reportCard,
  onUpdated,
}: {
  reportCard: ReportCardDetails;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    conductNote: reportCard.conductNote ?? "",
    teacherComment: reportCard.teacherComment ?? "",
    directorComment: reportCard.directorComment ?? "",
    finalDecisionOverride: reportCard.finalDecisionOverride ?? "",
    finalRemarks: reportCard.finalRemarks ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveComments() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        `/api/report-cards/cards/${reportCard.id}/comments`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to save report card comments.");
      }

      setMessage("Report card comments saved successfully.");
      onUpdated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save report card comments.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 print:hidden">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          Report Card Comments
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Add conduct notes, teacher comments, director comments, and final remarks before printing.
        </p>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <textarea
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Conduct note"
          value={form.conductNote}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, conductNote: e.target.value }))
          }
        />

        <textarea
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Teacher comment"
          value={form.teacherComment}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, teacherComment: e.target.value }))
          }
        />

        <textarea
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Director comment"
          value={form.directorComment}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, directorComment: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Final decision override optional"
          value={form.finalDecisionOverride}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              finalDecisionOverride: e.target.value,
            }))
          }
        />

        <textarea
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          placeholder="Final remarks"
          value={form.finalRemarks}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, finalRemarks: e.target.value }))
          }
        />
      </div>

      <div className="mt-5">
        <button
          type="button"
          disabled={saving}
          onClick={saveComments}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Comments"}
        </button>
      </div>
    </div>
  );
}