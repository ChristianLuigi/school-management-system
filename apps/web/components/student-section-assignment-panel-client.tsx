"use client";

import { useState } from "react";
import { SectionSelectorClient } from "@/components/section-selector-client";

export function StudentSectionAssignmentPanelClient({
  schoolId,
  studentId,
  currentSectionId,
  onUpdated,
}: {
  schoolId: string;
  studentId: string;
  currentSectionId?: string | null;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState(currentSectionId ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function assignSection() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!sectionId) {
        throw new Error("Please select a class/section.");
      }

      const res = await fetch(`/api/school-students/${studentId}/section`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          sectionId,
          reason,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to assign class/section.");
      }

      setMessage("Class/section updated successfully.");
      setReason("");
      setOpen(false);
      onUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to assign class/section.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Class Assignment
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Assign or change the student's active class/section.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSectionId(currentSectionId ?? "");
            setOpen((value) => !value);
          }}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          {open ? "Close" : currentSectionId ? "Change Class" : "Assign Class"}
        </button>
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

      {open ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <SectionSelectorClient
            schoolId={schoolId}
            sectionId={sectionId}
            onSectionIdChange={setSectionId}
            label="Affectation classe / section"
            allowEmpty
          />

          <textarea
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Reason / note optional"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />

          <button
            type="button"
            disabled={saving || !sectionId}
            onClick={assignSection}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Class Assignment"}
          </button>
        </div>
      ) : null}
    </div>
  );
}