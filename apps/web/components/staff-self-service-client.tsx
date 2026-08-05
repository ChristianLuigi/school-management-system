"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { SchoolBadge, SchoolPanel } from "@/components/school-ui";

type StaffProfile = {
  id: string;
  staffCode: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountryCode: string | null;
  staffCategory: string;
  employmentType: string;
  employmentStatus: string;
  hireDate: string | null;
  jobTitle: string | null;
  department: string | null;
  workLocation: string | null;
  supervisorName: string | null;
};

type StaffDocument = {
  id: string;
  documentType: string;
  displayName: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  issuedOn: string | null;
  expiresOn: string | null;
  expiryStatus: "NOT_APPLICABLE" | "CURRENT" | "EXPIRING_SOON" | "EXPIRED";
  createdAt: string;
};

type LeaveRequest = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  reason: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewedAt: string | null;
  reviewNote: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
};

const LEAVE_TYPES = [
  "ANNUAL",
  "SICK",
  "MATERNITY",
  "PATERNITY",
  "BEREAVEMENT",
  "UNPAID",
  "OTHER",
] as const;

const COPY = {
  fr: {
    employment: "Emploi",
    contact: "Coordonn\u00e9es",
    documents: "Mes documents",
    documentsHelp:
      "Seuls vos documents actifs de confidentialit\u00e9 standard sont disponibles ici.",
    leave: "Mes demandes de cong\u00e9",
    leaveHelp: "Soumettez une demande et suivez la decision administrative.",
    name: "Nom",
    staffCode: "Code du personnel",
    position: "Poste",
    department: "D\u00e9partement",
    category: "Cat\u00e9gorie",
    employmentType: "Type d'emploi",
    status: "Statut",
    hireDate: "Date d'embauche",
    supervisor: "Superviseur",
    workLocation: "Lieu de travail",
    email: "Adresse \u00e9lectronique",
    phone: "T\u00e9l\u00e9phone",
    address: "Adresse",
    notProvided: "Non renseign\u00e9",
    download: "T\u00e9l\u00e9charger",
    expires: "Expiration",
    noDocuments: "Aucun document standard actif.",
    leaveType: "Type de cong\u00e9",
    startDate: "Date de d\u00e9but",
    endDate: "Date de fin",
    requestedDays: "Nombre de jours",
    reason: "Motif",
    submit: "Soumettre la demande",
    submitting: "Envoi...",
    submitted: "La demande de cong\u00e9 a \u00e9t\u00e9 soumise.",
    withdrawn: "La demande de cong\u00e9 a \u00e9t\u00e9 retir\u00e9e.",
    withdraw: "Retirer",
    confirmWithdraw: "Retirer cette demande de cong\u00e9 en attente ?",
    noLeave: "Aucune demande de cong\u00e9.",
    loading: "Chargement de votre dossier...",
    refresh: "Actualiser",
    approved: "Approuv\u00e9e",
    rejected: "Rejet\u00e9e",
    cancelled: "Annul\u00e9e",
    pending: "En attente",
    reviewNote: "Note de r\u00e9vision",
    documentCurrent: "Valide",
    documentExpiring: "Expire bient\u00f4t",
    documentExpired: "Expir\u00e9",
    documentNoExpiry: "Sans expiration",
  },
  en: {
    employment: "Employment",
    contact: "Contact details",
    documents: "My documents",
    documentsHelp:
      "Only your active standard-confidentiality documents are available here.",
    leave: "My leave requests",
    leaveHelp: "Submit a request and follow the administrative decision.",
    name: "Name",
    staffCode: "Staff code",
    position: "Position",
    department: "Department",
    category: "Category",
    employmentType: "Employment type",
    status: "Status",
    hireDate: "Hire date",
    supervisor: "Supervisor",
    workLocation: "Work location",
    email: "Email",
    phone: "Phone",
    address: "Address",
    notProvided: "Not provided",
    download: "Download",
    expires: "Expires",
    noDocuments: "No active standard documents.",
    leaveType: "Leave type",
    startDate: "Start date",
    endDate: "End date",
    requestedDays: "Requested days",
    reason: "Reason",
    submit: "Submit request",
    submitting: "Submitting...",
    submitted: "The leave request was submitted.",
    withdrawn: "The leave request was withdrawn.",
    withdraw: "Withdraw",
    confirmWithdraw: "Withdraw this pending leave request?",
    noLeave: "No leave requests.",
    loading: "Loading your staff record...",
    refresh: "Refresh",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
    pending: "Pending",
    reviewNote: "Review note",
    documentCurrent: "Current",
    documentExpiring: "Expiring soon",
    documentExpired: "Expired",
    documentNoExpiry: "No expiration",
  },
} as const;

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export function StaffSelfServiceClient({ schoolId }: { schoolId: string }) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [leaveType, setLeaveType] =
    useState<(typeof LEAVE_TYPES)[number]>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [requestedDays, setRequestedDays] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = `schoolId=${encodeURIComponent(schoolId)}`;
      const responses = await Promise.all([
        fetch(`/api/staff-self-service/profile?${query}`, {
          cache: "no-store",
        }),
        fetch(`/api/staff-self-service/documents?${query}`, {
          cache: "no-store",
        }),
        fetch(`/api/staff-self-service/leave-requests?${query}`, {
          cache: "no-store",
        }),
      ]);
      const bodies = await Promise.all(
        responses.map((response) => response.json().catch(() => null)),
      );
      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex >= 0) {
        throw new Error(
          bodies[failedIndex]?.message ?? "Unable to load your staff record.",
        );
      }
      setProfile(bodies[0] as StaffProfile);
      setDocuments((bodies[1]?.items ?? []) as StaffDocument[]);
      setLeaveRequests((bodies[2]?.items ?? []) as LeaveRequest[]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load your staff record.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/staff-self-service/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          leaveType,
          startDate,
          endDate,
          requestedDays: Number(requestedDays),
          reason,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to submit leave request.");
      }
      setMessage(copy.submitted);
      setStartDate("");
      setEndDate("");
      setRequestedDays("");
      setReason("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to submit leave request.",
      );
    } finally {
      setSubmitting(false);
    }
  }


  async function withdrawLeave(request: LeaveRequest) {
    if (!window.confirm(copy.confirmWithdraw)) return;
    setActingId(request.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/staff-self-service/leave-requests/${encodeURIComponent(
          request.id,
        )}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            rowVersion: request.rowVersion,
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to withdraw leave request.");
      }
      setMessage(copy.withdrawn);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to withdraw leave request.",
      );
    } finally {
      setActingId("");
    }
  }
  function display(value: string | null | undefined) {
    return value?.trim() || copy.notProvided;
  }

  function statusLabel(status: LeaveRequest["status"]) {
    if (status === "APPROVED") return copy.approved;
    if (status === "REJECTED") return copy.rejected;
    if (status === "CANCELLED") return copy.cancelled;
    return copy.pending;
  }

  function documentStatus(document: StaffDocument) {
    if (document.expiryStatus === "EXPIRED") return copy.documentExpired;
    if (document.expiryStatus === "EXPIRING_SOON") {
      return copy.documentExpiring;
    }
    if (document.expiryStatus === "CURRENT") return copy.documentCurrent;
    return copy.documentNoExpiry;
  }

  function address() {
    if (!profile) return copy.notProvided;
    return [
      profile.addressLine1,
      profile.addressLine2,
      profile.addressCity,
      profile.addressRegion,
      profile.addressPostalCode,
      profile.addressCountryCode,
    ]
      .filter(Boolean)
      .join(", ") || copy.notProvided;
  }

  if (loading && !profile) {
    return <p className="text-sm text-slate-500">{copy.loading}</p>;
  }

  if (!profile) {
    return (
      <div className="space-y-3">
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error || "Unable to load your staff record."}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {copy.refresh}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
          <SchoolPanel title={copy.employment}>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail
                label={copy.name}
                value={display(
                  [profile.preferredName || profile.firstName, profile.lastName]
                    .filter(Boolean)
                    .join(" "),
                )}
              />
              <Detail label={copy.staffCode} value={display(profile.staffCode)} />
              <Detail label={copy.position} value={display(profile.jobTitle)} />
              <Detail label={copy.department} value={display(profile.department)} />
              <Detail
                label={copy.category}
                value={profile.staffCategory.replaceAll("_", " ")}
              />
              <Detail
                label={copy.employmentType}
                value={profile.employmentType.replaceAll("_", " ")}
              />
              <Detail
                label={copy.status}
                value={profile.employmentStatus.replaceAll("_", " ")}
              />
              <Detail label={copy.hireDate} value={display(profile.hireDate)} />
              <Detail
                label={copy.supervisor}
                value={display(profile.supervisorName)}
              />
              <Detail
                label={copy.workLocation}
                value={display(profile.workLocation)}
              />
            </dl>
          </SchoolPanel>

          <SchoolPanel title={copy.contact}>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label={copy.email} value={display(profile.email)} />
              <Detail label={copy.phone} value={display(profile.phone)} />
              <div className="sm:col-span-2">
                <Detail label={copy.address} value={address()} />
              </div>
            </dl>
          </SchoolPanel>
      </div>

      <SchoolPanel
        title={copy.documents}
        subtitle={copy.documentsHelp}
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {copy.refresh}
          </button>
        }
      >
        <div className="space-y-3">
          {!documents.length ? (
            <p className="text-sm text-slate-500">{copy.noDocuments}</p>
          ) : null}
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-950">
                  {document.displayName}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {document.documentType.replaceAll("_", " ")}
                  {document.expiresOn
                    ? ` · ${copy.expires}: ${document.expiresOn}`
                    : ""}
                </div>
                <div className="mt-2">
                  <SchoolBadge
                    tone={
                      document.expiryStatus === "EXPIRED"
                        ? "red"
                        : document.expiryStatus === "EXPIRING_SOON"
                          ? "amber"
                          : "green"
                    }
                  >
                    {documentStatus(document)}
                  </SchoolBadge>
                </div>
              </div>
              <a
                href={
                  `/api/staff-self-service/documents/${encodeURIComponent(
                    document.id,
                  )}/download?schoolId=${encodeURIComponent(schoolId)}`
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                {copy.download}
              </a>
            </div>
          ))}
        </div>
      </SchoolPanel>

      <SchoolPanel title={copy.leave} subtitle={copy.leaveHelp}>
        <form onSubmit={submitLeave}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm">
              <span className="font-medium">{copy.leaveType}</span>
              <select
                value={leaveType}
                onChange={(event) =>
                  setLeaveType(
                    event.target.value as (typeof LEAVE_TYPES)[number],
                  )
                }
                className="staff-input"
              >
                {LEAVE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">{copy.startDate}</span>
              <input
                required
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="staff-input"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">{copy.endDate}</span>
              <input
                required
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="staff-input"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">{copy.requestedDays}</span>
              <input
                required
                type="number"
                min="0.25"
                max="366"
                step="0.25"
                value={requestedDays}
                onChange={(event) => setRequestedDays(event.target.value)}
                className="staff-input"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="font-medium">{copy.reason}</span>
              <input
                required
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="staff-input"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? copy.submitting : copy.submit}
          </button>
        </form>

        <div className="mt-6 space-y-3 border-t border-slate-200 pt-6">
          {!leaveRequests.length ? (
            <p className="text-sm text-slate-500">{copy.noLeave}</p>
          ) : null}
          {leaveRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-950">
                    {request.leaveType.replaceAll("_", " ")}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {request.startDate} - {request.endDate} · {request.requestedDays}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{request.reason}</p>
                  {request.reviewNote ? (
                    <p className="mt-2 text-sm text-slate-600">
                      {copy.reviewNote}: {request.reviewNote}
                    </p>
                  ) : null}
                </div>
                <SchoolBadge
                  tone={
                    request.status === "APPROVED"
                      ? "green"
                      : request.status === "REJECTED"
                        ? "red"
                        : request.status === "CANCELLED"
                          ? "neutral"
                          : "amber"
                  }
                >
                  {statusLabel(request.status)}
                </SchoolBadge>
                {request.status === "SUBMITTED" ? (
                  <button
                    type="button"
                    disabled={actingId === request.id}
                    onClick={() => void withdrawLeave(request)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
                  >
                    {copy.withdraw}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SchoolPanel>
    </div>
  );
}
