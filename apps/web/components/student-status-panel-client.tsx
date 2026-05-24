"use client";

import { useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

const STUDENT_STATUSES = [
  "PRE_REGISTERED",
  "REGISTERED",
  "ACTIVE",
  "SUSPENDED",
  "WITHDRAWN",
  "TRANSFERRED",
  "GRADUATED",
  "ARCHIVED",
];

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

export function studentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PRE_REGISTERED: "Préinscrit",
    REGISTERED: "Inscrit",
    ACTIVE: "Actif",
    SUSPENDED: "Suspendu",
    WITHDRAWN: "Retiré",
    TRANSFERRED: "Transféré",
    GRADUATED: "Diplômé",
    ARCHIVED: "Archivé",
  };

  return labels[status] ?? status;
}

export function studentStatusTone(status: string): BadgeTone {
  if (status === "ACTIVE") return "green";
  if (status === "REGISTERED" || status === "PRE_REGISTERED") return "blue";
  if (status === "SUSPENDED") return "amber";
  if (["WITHDRAWN", "TRANSFERRED", "ARCHIVED"].includes(status)) return "red";
  if (status === "GRADUATED") return "green";
  return "neutral";
}

type StudentStatusHistoryRow = {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  reason: string | null;
  changedByUserId: string | null;
  changedAt: string;
};

export function StudentStatusPanelClient({
  schoolId,
  studentId,
  currentStatus,
  hasCurrentEnrollment,
  statusHistory,
  onUpdated,
}: {
  schoolId: string;
  studentId: string;
  currentStatus: string;
  hasCurrentEnrollment: boolean;
  statusHistory: StudentStatusHistoryRow[];
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setNewStatus(currentStatus);
  }, [currentStatus]);

  const activeBlocked = newStatus === "ACTIVE" && !hasCurrentEnrollment;

  async function changeStatus() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (activeBlocked) {
        throw new Error(
          "A student must have an active class/section before becoming active.",
        );
      }

      const res = await fetch(`/api/school-students/${studentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          newStatus,
          reason,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to change student status.");
      }

      setMessage("Student status updated successfully.");
      setReason("");
      setOpen(false);
      onUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change student status.",
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
            Student Status
          </h3>

          <p className="mt-1 text-sm text-slate-600">
            Manage the administrative lifecycle of this student.
          </p>

          <div className="mt-3">
            <SchoolBadge tone={studentStatusTone(currentStatus)}>
              {studentStatusLabel(currentStatus)}
            </SchoolBadge>
          </div>
        </div>

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
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={newStatus}
            onChange={(event) => setNewStatus(event.target.value)}
          >
            {STUDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {studentStatusLabel(status)}
              </option>
            ))}
          </select>

          {activeBlocked ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This student cannot be marked active until a class/section is assigned.
            </div>
          ) : null}

          <textarea
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Reason / administrative note"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />

          <button
            type="button"
            disabled={saving || activeBlocked}
            onClick={changeStatus}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Status"}
          </button>
        </div>
      ) : null}

      <div className="mt-5">
        <div className="mb-3 font-semibold text-slate-900">
          Status History
        </div>

        <div className="space-y-2">
          {statusHistory.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">
                  {row.previousStatus
                    ? studentStatusLabel(row.previousStatus)
                    : "Initial"}
                </span>
                <span>-&gt;</span>
                <SchoolBadge tone={studentStatusTone(row.newStatus)}>
                  {studentStatusLabel(row.newStatus)}
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