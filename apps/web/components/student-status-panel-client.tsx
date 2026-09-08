"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  GraduationCap,
  History,
  LoaderCircle,
  PauseCircle,
  RotateCcw,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SchoolBadge } from "@/components/school-ui";
import { useI18n } from "@/components/i18n-provider";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

export function studentStatusLabel(
  status: string,
  translate?: (key: string) => string,
) {
  if (translate) {
    const key =
      status === "PRE_REGISTERED"
        ? "preRegistered"
        : status.toLowerCase();
    const label = translate(`students.${key}`);
    if (!label.startsWith("students.")) return label;
  }
  const labels: Record<string, string> = {
    PRE_REGISTERED: "Pre-registered",
    REGISTERED: "Registered",
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    WITHDRAWN: "Withdrawn",
    TRANSFERRED: "Transferred",
    GRADUATED: "Graduated",
    ARCHIVED: "Archived",
  };

  return labels[status] ?? status;
}

export function studentStatusTone(status: string): BadgeTone {
  if (status === "ACTIVE" || status === "GRADUATED") return "green";
  if (status === "REGISTERED" || status === "PRE_REGISTERED") return "blue";
  if (status === "SUSPENDED") return "amber";
  if (["WITHDRAWN", "TRANSFERRED", "ARCHIVED"].includes(status)) return "red";
  return "neutral";
}

const TRANSITIONS: Record<string, string[]> = {
  PRE_REGISTERED: ["REGISTERED", "ARCHIVED"],
  REGISTERED: ["ACTIVE", "WITHDRAWN", "ARCHIVED"],
  ACTIVE: ["SUSPENDED", "WITHDRAWN", "TRANSFERRED", "GRADUATED"],
  SUSPENDED: ["ACTIVE", "WITHDRAWN", "TRANSFERRED", "ARCHIVED"],
  WITHDRAWN: ["REGISTERED", "ARCHIVED"],
  TRANSFERRED: ["REGISTERED", "ARCHIVED"],
  GRADUATED: ["ARCHIVED"],
  ARCHIVED: ["REGISTERED"],
};

const STATUS_META: Record<
  string,
  { icon: LucideIcon; tone: string; actionKey: string }
> = {
  REGISTERED: {
    icon: UserCheck,
    tone: "border-blue-200 bg-blue-50 text-blue-800",
    actionKey: "students.statusActions.REGISTERED",
  },
  ACTIVE: {
    icon: UserCheck,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    actionKey: "students.statusActions.ACTIVE",
  },
  SUSPENDED: {
    icon: PauseCircle,
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    actionKey: "students.statusActions.SUSPENDED",
  },
  WITHDRAWN: {
    icon: UserX,
    tone: "border-red-200 bg-red-50 text-red-800",
    actionKey: "students.statusActions.WITHDRAWN",
  },
  TRANSFERRED: {
    icon: ArrowRightLeft,
    tone: "border-orange-200 bg-orange-50 text-orange-800",
    actionKey: "students.statusActions.TRANSFERRED",
  },
  GRADUATED: {
    icon: GraduationCap,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    actionKey: "students.statusActions.GRADUATED",
  },
  ARCHIVED: {
    icon: Archive,
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    actionKey: "students.statusActions.ARCHIVED",
  },
};

type StudentStatusHistoryRow = {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  reason: string | null;
  changedByUserId: string | null;
  changedAt: string;
};

function transitionRequiresReason(currentStatus: string, newStatus: string) {
  return !["PRE_REGISTERED:REGISTERED", "REGISTERED:ACTIVE"].includes(
    `${currentStatus}:${newStatus}`,
  );
}

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
  const { locale, t } = useI18n();
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedStatus(null);
    setReason("");
  }, [currentStatus]);

  const options = TRANSITIONS[currentStatus] ?? [];
  const activeBlocked = selectedStatus === "ACTIVE" && !hasCurrentEnrollment;
  const reasonRequired = selectedStatus
    ? transitionRequiresReason(currentStatus, selectedStatus)
    : false;
  const canSubmit =
    Boolean(selectedStatus) &&
    !activeBlocked &&
    (!reasonRequired || Boolean(reason.trim()));

  function requestStatusChange() {
    if (!selectedStatus || !canSubmit) return;
    const sensitive = [
      "SUSPENDED",
      "WITHDRAWN",
      "TRANSFERRED",
      "GRADUATED",
      "ARCHIVED",
    ].includes(selectedStatus);
    if (sensitive) {
      setConfirmationOpen(true);
      return;
    }
    void changeStatus();
  }

  async function changeStatus() {
    if (!selectedStatus || !canSubmit) return;
    setConfirmationOpen(false);
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/school-students/${studentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          newStatus: selectedStatus,
          reason: reason.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.message ?? t("students.statusUpdateFailed"),
        );
      }

      setMessage(t("students.statusUpdated"));
      setSelectedStatus(null);
      setReason("");
      onUpdated();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
            : t("students.statusUpdateFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
            <RotateCcw className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold text-slate-950">
              {t("students.lifecycle")}
            </h3>
            <div className="mt-1">
              <SchoolBadge tone={studentStatusTone(currentStatus)}>
                {studentStatusLabel(currentStatus, t)}
              </SchoolBadge>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowHistory((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <History className="h-4 w-4" />
          {t("students.history")}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
            {statusHistory.length}
          </span>
        </button>
      </div>

      <div className="border-t border-slate-200 p-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {options.map((status) => {
            const meta = STATUS_META[status] ?? {
              icon: ArrowRight,
              tone: "border-slate-200 bg-slate-50 text-slate-700",
              actionKey: "",
            };
            const Icon = meta.icon;
            const selected = selectedStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setSelectedStatus(selected ? null : status);
                  setReason("");
                  setError("");
                }}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition ${meta.tone} ${
                  selected ? "ring-2 ring-slate-900 ring-offset-2" : ""
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {meta.actionKey
                  ? t(meta.actionKey)
                  : studentStatusLabel(status, t)}
              </button>
            );
          })}
        </div>

        {selectedStatus ? (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">
                {studentStatusLabel(currentStatus, t)}
                <ArrowRight className="mx-2 inline h-4 w-4" />
                {studentStatusLabel(selectedStatus, t)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedStatus(null)}
                aria-label={t("students.cancelStatusChange")}
                className="rounded-lg p-1 text-slate-500 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeBlocked ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {t("students.assignClassBeforeActivation")}
              </div>
            ) : null}

            {reasonRequired ? (
              <label className="block text-sm font-medium text-slate-700">
                {t("students.reason")}
                <textarea
                  required
                  maxLength={500}
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t("students.administrativeReason")}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            ) : null}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving || !canSubmit}
                onClick={requestStatusChange}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t("common.confirm")}
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      {showHistory ? (
        <div className="border-t border-slate-200 p-5">
          <div className="space-y-3">
            {statusHistory.map((row) => (
              <div key={row.id} className="flex gap-3 text-sm">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {row.previousStatus
                        ? studentStatusLabel(row.previousStatus, t)
                        : t("students.createdStatus")}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    <SchoolBadge tone={studentStatusTone(row.newStatus)}>
                      {studentStatusLabel(row.newStatus, t)}
                    </SchoolBadge>
                    <time className="ml-auto text-xs text-slate-500">
                      {new Date(row.changedAt).toLocaleString(
                        locale === "fr" ? "fr-HT" : "en-US",
                      )}
                    </time>
                  </div>
                  {row.reason ? (
                    <p className="mt-1 text-slate-600">{row.reason}</p>
                  ) : null}
                </div>
              </div>
            ))}
            {!statusHistory.length ? (
              <p className="text-sm text-slate-500">
                {t("students.noLifecycleHistory")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <ConfirmationDialog
        open={confirmationOpen}
        title={t("students.lifecycle")}
        description={t("students.confirmStatusChange", {
          status: selectedStatus
            ? studentStatusLabel(selectedStatus, t)
            : "",
        })}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        busy={saving}
        destructive
        onCancel={() => setConfirmationOpen(false)}
        onConfirm={() => void changeStatus()}
      />
    </section>
  );
}
