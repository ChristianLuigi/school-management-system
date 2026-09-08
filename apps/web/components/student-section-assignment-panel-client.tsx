"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  Save,
  X,
} from "lucide-react";
import {
  SectionOption,
  SectionSelectorClient,
  sectionOptionLabel,
} from "@/components/section-selector-client";

const PLACEABLE_STATUSES = ["PRE_REGISTERED", "REGISTERED", "ACTIVE"];

export function StudentSectionAssignmentPanelClient({
  schoolId,
  studentId,
  currentSectionId,
  currentSectionLabel,
  currentStatus,
  onUpdated,
}: {
  schoolId: string;
  studentId: string;
  currentSectionId?: string | null;
  currentSectionLabel: string;
  currentStatus: string;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState(currentSectionId ?? "");
  const [selectedSection, setSelectedSection] = useState<SectionOption | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [activateStudent, setActivateStudent] = useState(
    currentStatus === "PRE_REGISTERED" || currentStatus === "REGISTERED",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isDifferentSection =
    Boolean(sectionId) && sectionId !== (currentSectionId ?? "");
  const isTransfer = Boolean(currentSectionId) && isDifferentSection;
  const canPlace = PLACEABLE_STATUSES.includes(currentStatus);
  const reasonRequired = isTransfer;
  const canSubmit =
    canPlace &&
    Boolean(selectedSection) &&
    isDifferentSection &&
    (!reasonRequired || Boolean(reason.trim())) &&
    !selectedSection?.atCapacity;

  function resetForm() {
    setSectionId(currentSectionId ?? "");
    setSelectedSection(null);
    setReason("");
    setActivateStudent(
      currentStatus === "PRE_REGISTERED" || currentStatus === "REGISTERED",
    );
    setError("");
  }

  async function assignSection() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!canSubmit) {
        throw new Error(
          reasonRequired && !reason.trim()
            ? "Enter a reason for this transfer."
            : "Select an available class.",
        );
      }

      const response = await fetch(
        `/api/school-students/${studentId}/section`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            sectionId,
            reason: reason.trim() || undefined,
            activateStudent:
              currentStatus === "PRE_REGISTERED" ||
              currentStatus === "REGISTERED"
                ? activateStudent
                : undefined,
          }),
        },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to update enrollment.");
      }

      setMessage(
        isTransfer
          ? "Student transferred successfully."
          : "Academic placement saved.",
      );
      setOpen(false);
      onUpdated();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update enrollment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-950">Academic placement</h3>
            <p className="truncate text-sm text-slate-500">
              {currentSectionId ? currentSectionLabel : "No class assigned"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              resetForm();
              setOpen(true);
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          {open ? (
            <X className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {open ? "Close" : currentSectionId ? "Transfer" : "Assign class"}
        </button>
      </div>

      {message ? (
        <div className="mx-5 mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mx-5 mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {open ? (
        <div className="space-y-4 border-t border-slate-200 bg-slate-50/70 p-5">
          {!canPlace ? (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Update the student lifecycle status before assigning a class.
            </div>
          ) : null}

          <SectionSelectorClient
            schoolId={schoolId}
            sectionId={sectionId}
            onSectionIdChange={setSectionId}
            onSectionDetailsChange={setSelectedSection}
            allowEmpty
            emptyLabel="Select a class"
            allowFullSectionId={currentSectionId}
          />

          {isDifferentSection ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-slate-500">
                {currentSectionId ? currentSectionLabel : "Unassigned"}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">
                {selectedSection
                  ? sectionOptionLabel(selectedSection).split(" · ")[0]
                  : "Select a class"}
              </span>
            </div>
          ) : null}

          {isTransfer ? (
            <label className="block text-sm font-medium text-slate-700">
              Transfer reason
              <textarea
                required
                maxLength={500}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for changing the active section"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
          ) : null}

          {currentStatus === "PRE_REGISTERED" ||
          currentStatus === "REGISTERED" ? (
            <label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <input
                type="checkbox"
                checked={activateStudent}
                onChange={(event) => setActivateStudent(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-semibold">
                  Activate after placement
                </span>
                <span className="text-blue-700">
                  The student becomes active as soon as the class is saved.
                </span>
              </span>
            </label>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving || !canSubmit}
              onClick={() => void assignSection()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Saving..." : isTransfer ? "Confirm transfer" : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
