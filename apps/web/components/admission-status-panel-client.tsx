"use client";

import { useState } from "react";
import { SchoolBadge, type SchoolBadgeTone } from "@/components/school-ui";

export const ADMISSION_STATUSES = [
  "PROSPECT",
  "APPLICATION_SUBMITTED",
  "DOCUMENTS_INCOMPLETE",
  "PENDING_PAYMENT",
  "PENDING_EXAM",
  "EXAM_SCHEDULED",
  "ADMITTED",
  "CONDITIONALLY_ADMITTED",
  "WAITLISTED",
  "REJECTED",
  "CONFIRMED",
  "CONVERTED_TO_STUDENT",
  "CANCELLED",
];

export function admissionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PROSPECT: "Prospect",
    APPLICATION_SUBMITTED: "Demande soumise",
    DOCUMENTS_INCOMPLETE: "Documents incomplets",
    PENDING_PAYMENT: "En attente de paiement",
    PENDING_EXAM: "En attente d'examen",
    EXAM_SCHEDULED: "Examen planifie",
    ADMITTED: "Admis",
    CONDITIONALLY_ADMITTED: "Admis sous condition",
    WAITLISTED: "Liste d'attente",
    REJECTED: "Refuse",
    CONFIRMED: "Confirme",
    CONVERTED_TO_STUDENT: "Converti en eleve",
    CANCELLED: "Annule",
  };

  return labels[status] ?? status;
}

export function admissionStatusTone(status: string): SchoolBadgeTone {
  if (status === "ADMITTED" || status === "CONFIRMED") return "green";
  if (status === "REJECTED" || status === "CANCELLED") return "red";
  if (
    status === "DOCUMENTS_INCOMPLETE" ||
    status === "PENDING_PAYMENT" ||
    status === "PENDING_EXAM"
  ) {
    return "amber";
  }
  if (status === "CONVERTED_TO_STUDENT") return "neutral";
  return "blue";
}

export type AdmissionStatusHistoryRow = {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  reason: string | null;
  changedByUserId: string | null;
  changedAt: string;
};

export function AdmissionStatusPanelClient({
  schoolId,
  admissionApplicationId,
  currentStatus,
  statusHistory,
  convertedStudentId,
  onChanged,
}: {
  schoolId: string;
  admissionApplicationId: string;
  currentStatus: string;
  statusHistory: AdmissionStatusHistoryRow[];
  convertedStudentId?: string | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function changeStatus() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        `/api/admissions/${admissionApplicationId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schoolId,
            newStatus,
            reason,
          }),
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to update admission status.");
      }

      setMessage("Admission status updated successfully.");
      setReason("");
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update admission status.",
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
            Admission Status
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Track the application from submission to admission decision.
          </p>

          <div className="mt-3">
            <SchoolBadge tone={admissionStatusTone(currentStatus)}>
              {admissionStatusLabel(currentStatus)}
            </SchoolBadge>
          </div>
        </div>

        {!convertedStudentId ? (
          <button
            type="button"
            onClick={() => {
              setNewStatus(currentStatus);
              setOpen((value) => !value);
            }}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            {open ? "Close" : "Change Status"}
          </button>
        ) : null}
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

      {convertedStudentId ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          This application has already been converted into a student file.
        </div>
      ) : null}

      {open ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={newStatus}
            onChange={(event) => setNewStatus(event.target.value)}
          >
            {ADMISSION_STATUSES.filter(
              (status) => status !== "CONVERTED_TO_STUDENT",
            ).map((status) => (
              <option key={status} value={status}>
                {admissionStatusLabel(status)}
              </option>
            ))}
          </select>

          <textarea
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Reason / administrative note"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />

          <button
            type="button"
            disabled={saving}
            onClick={changeStatus}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Status"}
          </button>
        </div>
      ) : null}

      <div className="mt-5">
        <div className="mb-3 font-semibold text-slate-900">Status History</div>

        <div className="space-y-2">
          {statusHistory.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">
                  {row.previousStatus
                    ? admissionStatusLabel(row.previousStatus)
                    : "Initial"}
                </span>
                <span>-&gt;</span>
                <SchoolBadge tone={admissionStatusTone(row.newStatus)}>
                  {admissionStatusLabel(row.newStatus)}
                </SchoolBadge>
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {new Date(row.changedAt).toLocaleString()}
              </div>

              {row.reason ? (
                <div className="mt-1 text-sm text-slate-600">{row.reason}</div>
              ) : null}
            </div>
          ))}

          {statusHistory.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
              No status history yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
