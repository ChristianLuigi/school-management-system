"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";

type DocumentItem = {
  id: string;
  documentType: string;
  displayName: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  issuedOn: string | null;
  expiresOn: string | null;
  confidentiality: "STANDARD" | "RESTRICTED";
  status: "ACTIVE" | "REVOKED";
  expiryStatus:
    | "NOT_APPLICABLE"
    | "CURRENT"
    | "EXPIRING_SOON"
    | "EXPIRED"
    | "REVOKED";
  rowVersion: number;
  revokedAt: string | null;
  revocationReason: string | null;
  createdAt: string;
};

type LeaveItem = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  reason: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";
  rowVersion: number;
  reviewNote: string | null;
  events: Array<{
    id: string;
    type: string;
    note: string | null;
    createdAt: string;
  }>;
};

const DOCUMENT_TYPES = [
  "IDENTITY",
  "CONTRACT",
  "CERTIFICATION",
  "LICENSE",
  "BACKGROUND_CHECK",
  "WORK_PERMIT",
  "OTHER",
] as const;

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
    loading: "Chargement…",
    documentsTitle: "Documents et qualifications",
    documentsDescription:
      "Conservez les contrats, licences et justificatifs dans le stockage privé. Taille maximale : 10 Mo.",
    displayName: "Nom du document",
    documentType: "Type",
    confidentiality: "Confidentialité",
    standard: "Standard",
    restricted: "Restreint",
    issuedOn: "Date d’émission",
    expiresOn: "Date d’expiration",
    file: "Fichier PDF ou image",
    upload: "Ajouter le document",
    uploading: "Téléversement…",
    noDocuments: "Aucun document enregistré.",
    download: "Télécharger",
    revoke: "Révoquer",
    revokeReason: "Motif de la révocation",
    active: "Actif",
    revoked: "Révoqué",
    current: "À jour",
    expiring: "Expire bientôt",
    expired: "Expiré",
    noExpiry: "Sans expiration",
    leaveTitle: "Demandes de congé",
    leaveDescription:
      "Enregistrez une demande, puis faites-la approuver par un autre administrateur lorsque l’école en compte plusieurs.",
    leaveType: "Type de congé",
    startDate: "Début",
    endDate: "Fin",
    requestedDays: "Jours demandés",
    reason: "Motif",
    submitLeave: "Soumettre la demande",
    submitting: "Envoi…",
    noLeave: "Aucune demande de congé.",
    approve: "Approuver",
    reject: "Rejeter",
    cancel: "Annuler",
    actionNote: "Note de décision",
    submitted: "Soumise",
    approved: "Approuvée",
    rejected: "Rejetée",
    cancelled: "Annulée",
    documentSaved: "Le document a été ajouté.",
    documentRevoked: "Le document a été révoqué.",
    leaveSaved: "La demande de congé a été soumise.",
    leaveUpdated: "La demande de congé a été mise à jour.",
  },
  en: {
    loading: "Loading…",
    documentsTitle: "Documents and credentials",
    documentsDescription:
      "Keep contracts, licenses, and supporting documents in private storage. Maximum size: 10 MB.",
    displayName: "Document name",
    documentType: "Type",
    confidentiality: "Confidentiality",
    standard: "Standard",
    restricted: "Restricted",
    issuedOn: "Issued on",
    expiresOn: "Expires on",
    file: "PDF or image file",
    upload: "Add document",
    uploading: "Uploading…",
    noDocuments: "No documents recorded.",
    download: "Download",
    revoke: "Revoke",
    revokeReason: "Revocation reason",
    active: "Active",
    revoked: "Revoked",
    current: "Current",
    expiring: "Expiring soon",
    expired: "Expired",
    noExpiry: "No expiry",
    leaveTitle: "Leave requests",
    leaveDescription:
      "Record a request, then have another administrator approve it when the school has multiple administrators.",
    leaveType: "Leave type",
    startDate: "Start date",
    endDate: "End date",
    requestedDays: "Requested days",
    reason: "Reason",
    submitLeave: "Submit request",
    submitting: "Submitting…",
    noLeave: "No leave requests.",
    approve: "Approve",
    reject: "Reject",
    cancel: "Cancel",
    actionNote: "Decision note",
    submitted: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
    documentSaved: "The document was added.",
    documentRevoked: "The document was revoked.",
    leaveSaved: "The leave request was submitted.",
    leaveUpdated: "The leave request was updated.",
  },
} as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function responseBody(response: Response) {
  return response.json().catch(() => null);
}

export function StaffComplianceWorkspaceClient({
  schoolId,
  staffId,
  section,
}: {
  schoolId: string;
  staffId: string;
  section: "documents" | "leave";
}) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [actingId, setActingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [documentType, setDocumentType] =
    useState<(typeof DOCUMENT_TYPES)[number]>("CONTRACT");
  const [confidentiality, setConfidentiality] =
    useState<"STANDARD" | "RESTRICTED">("STANDARD");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [leaveType, setLeaveType] =
    useState<(typeof LEAVE_TYPES)[number]>("ANNUAL");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [requestedDays, setRequestedDays] = useState("1");
  const [leaveReason, setLeaveReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const operation = section === "documents" ? "documents" : "leave-requests";
      const query = new URLSearchParams({ schoolId }).toString();
      const response = await fetch(
        `/api/staff-management/staff/${encodeURIComponent(
          staffId,
        )}/${operation}?${query}`,
        { cache: "no-store" },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to load staff information.");
      }
      if (section === "documents") {
        setDocuments(body.items ?? []);
      } else {
        setLeaveRequests(body.items ?? []);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load staff information.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, section, staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError(copy.file);
      return;
    }
    setActing(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("schoolId", schoolId);
      formData.set("staffId", staffId);
      formData.set("documentType", documentType);
      formData.set("displayName", displayName);
      formData.set("confidentiality", confidentiality);
      if (issuedOn) formData.set("issuedOn", issuedOn);
      if (expiresOn) formData.set("expiresOn", expiresOn);
      formData.set("file", file);
      const response = await fetch("/api/uploads/staff-documents", {
        method: "POST",
        body: formData,
      });
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to upload document.");
      }
      setDisplayName("");
      setIssuedOn("");
      setExpiresOn("");
      setFile(null);
      const input = document.getElementById(
        "staff-document-file",
      ) as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage(copy.documentSaved);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to upload document.",
      );
    } finally {
      setActing(false);
    }
  }

  async function revokeDocument(documentItem: DocumentItem) {
    const reason = window.prompt(copy.revokeReason)?.trim();
    if (!reason) return;
    setActingId(documentItem.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/staff-management/staff/${encodeURIComponent(
          staffId,
        )}/documents/${encodeURIComponent(documentItem.id)}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            rowVersion: documentItem.rowVersion,
            reason,
          }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to revoke document.");
      }
      setMessage(copy.documentRevoked);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to revoke document.",
      );
    } finally {
      setActingId("");
    }
  }

  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActing(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/staff-management/staff/${encodeURIComponent(
          staffId,
        )}/leave-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            leaveType,
            startDate,
            endDate,
            requestedDays: Number(requestedDays),
            reason: leaveReason,
          }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to submit leave request.");
      }
      setLeaveReason("");
      setMessage(copy.leaveSaved);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to submit leave request.",
      );
    } finally {
      setActing(false);
    }
  }

  async function actOnLeave(
    leave: LeaveItem,
    action: "approve" | "reject" | "cancel",
  ) {
    const note =
      action === "approve"
        ? ""
        : window.prompt(copy.actionNote)?.trim() ?? "";
    if (action === "reject" && !note) return;
    if (action === "cancel" && !note) return;
    setActingId(leave.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/staff-management/leave-requests/${encodeURIComponent(
          leave.id,
        )}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            rowVersion: leave.rowVersion,
            note: note || undefined,
          }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to update leave request.");
      }
      setMessage(copy.leaveUpdated);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update leave request.",
      );
    } finally {
      setActingId("");
    }
  }

  const expiryLabel = (status: DocumentItem["expiryStatus"]) => {
    if (status === "EXPIRED") return copy.expired;
    if (status === "EXPIRING_SOON") return copy.expiring;
    if (status === "CURRENT") return copy.current;
    if (status === "REVOKED") return copy.revoked;
    return copy.noExpiry;
  };

  const leaveStatusLabel = (status: LeaveItem["status"]) => {
    if (status === "APPROVED") return copy.approved;
    if (status === "REJECTED") return copy.rejected;
    if (status === "CANCELLED") return copy.cancelled;
    return copy.submitted;
  };

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {section === "documents" ? (
        <>
          <form
            onSubmit={uploadDocument}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-lg font-semibold text-slate-950">
              {copy.documentsTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {copy.documentsDescription}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm">
                <span className="font-medium">{copy.displayName}</span>
                <input
                  required
                  maxLength={160}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="staff-input"
                />
              </label>
              <label className="text-sm">
                <span className="font-medium">{copy.documentType}</span>
                <select
                  value={documentType}
                  onChange={(event) =>
                    setDocumentType(
                      event.target.value as (typeof DOCUMENT_TYPES)[number],
                    )
                  }
                  className="staff-input"
                >
                  {DOCUMENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="font-medium">{copy.confidentiality}</span>
                <select
                  value={confidentiality}
                  onChange={(event) =>
                    setConfidentiality(
                      event.target.value as "STANDARD" | "RESTRICTED",
                    )
                  }
                  className="staff-input"
                >
                  <option value="STANDARD">{copy.standard}</option>
                  <option value="RESTRICTED">{copy.restricted}</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="font-medium">{copy.issuedOn}</span>
                <input
                  type="date"
                  value={issuedOn}
                  onChange={(event) => setIssuedOn(event.target.value)}
                  className="staff-input"
                />
              </label>
              <label className="text-sm">
                <span className="font-medium">{copy.expiresOn}</span>
                <input
                  type="date"
                  value={expiresOn}
                  onChange={(event) => setExpiresOn(event.target.value)}
                  className="staff-input"
                />
              </label>
              <label className="text-sm">
                <span className="font-medium">{copy.file}</span>
                <input
                  id="staff-document-file"
                  required
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="staff-input"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={acting}
              className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {acting ? copy.uploading : copy.upload}
            </button>
          </form>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">{copy.loading}</p>
            ) : null}
            {!loading && !documents.length ? (
              <p className="text-sm text-slate-500">{copy.noDocuments}</p>
            ) : null}
            {documents.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-950">
                      {item.displayName}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {item.documentType.replaceAll("_", " ")} ·{" "}
                      {Math.ceil(item.fileSizeBytes / 1024)} KB
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        {item.confidentiality === "RESTRICTED"
                          ? copy.restricted
                          : copy.standard}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 ${
                          item.expiryStatus === "EXPIRED"
                            ? "bg-red-50 text-red-700"
                            : item.expiryStatus === "EXPIRING_SOON"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-green-50 text-green-700"
                        }`}
                      >
                        {expiryLabel(item.expiryStatus)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {item.status === "ACTIVE" ? (
                      <>
                        <a
                          href={
                            `/api/uploads/staff-documents?schoolId=${encodeURIComponent(
                              schoolId,
                            )}&staffId=${encodeURIComponent(
                              staffId,
                            )}&documentId=${encodeURIComponent(item.id)}`
                          }
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                        >
                          {copy.download}
                        </a>
                        <button
                          type="button"
                          disabled={actingId === item.id}
                          onClick={() => void revokeDocument(item)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700"
                        >
                          {copy.revoke}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {copy.revoked}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <form
            onSubmit={submitLeave}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-lg font-semibold text-slate-950">
              {copy.leaveTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {copy.leaveDescription}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  value={leaveReason}
                  onChange={(event) => setLeaveReason(event.target.value)}
                  className="staff-input"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={acting}
              className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {acting ? copy.submitting : copy.submitLeave}
            </button>
          </form>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">{copy.loading}</p>
            ) : null}
            {!loading && !leaveRequests.length ? (
              <p className="text-sm text-slate-500">{copy.noLeave}</p>
            ) : null}
            {leaveRequests.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-950">
                      {item.leaveType.replaceAll("_", " ")}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {item.startDate} — {item.endDate} · {item.requestedDays}{" "}
                      {copy.requestedDays.toLowerCase()}
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{item.reason}</p>
                    <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs">
                      {leaveStatusLabel(item.status)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {item.status === "SUBMITTED" ? (
                      <>
                        <button
                          type="button"
                          disabled={actingId === item.id}
                          onClick={() => void actOnLeave(item, "approve")}
                          className="rounded-lg border border-green-200 px-3 py-1.5 text-xs text-green-700"
                        >
                          {copy.approve}
                        </button>
                        <button
                          type="button"
                          disabled={actingId === item.id}
                          onClick={() => void actOnLeave(item, "reject")}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700"
                        >
                          {copy.reject}
                        </button>
                      </>
                    ) : null}
                    {item.status === "SUBMITTED" ||
                    item.status === "APPROVED" ? (
                      <button
                        type="button"
                        disabled={actingId === item.id}
                        onClick={() => void actOnLeave(item, "cancel")}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      >
                        {copy.cancel}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
