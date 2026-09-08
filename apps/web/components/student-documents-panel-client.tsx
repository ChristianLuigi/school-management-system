"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  ShieldCheck,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { SchoolBadge, type SchoolBadgeTone } from "@/components/school-ui";

export type StudentDocumentRecord = {
  id: string;
  documentType: string;
  documentStatus: string;
  fileName: string | null;
  fileUrl: string | null;
  receivedAt: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
};

const EMPTY_FORM = {
  documentType: "BIRTH_CERTIFICATE",
  documentStatus: "PENDING",
  fileName: "",
  fileUrl: "",
  receivedAt: "",
  notes: "",
};

function documentTypeLabel(value: string) {
  const labels: Record<string, string> = {
    PHOTO: "Student photo",
    BIRTH_CERTIFICATE: "Birth certificate",
    VACCINATION_CARD: "Vaccination card",
    PREVIOUS_SCHOOL_RECORD: "Previous school record",
    OTHER: "Other document",
  };
  return labels[value] ?? value;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pending",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
  };
  return labels[status] ?? status;
}

function statusTone(status: string): SchoolBadgeTone {
  if (status === "VERIFIED") return "green";
  if (status === "REJECTED") return "red";
  return "amber";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
    </span>
  );
}

export function StudentDocumentsPanelClient({
  schoolId,
  studentId,
  documents,
  onChanged,
}: {
  schoolId: string;
  studentId: string;
  documents: StudentDocumentRecord[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actingId, setActingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counts = documents.reduce(
    (result, document) => {
      if (document.documentStatus === "VERIFIED") result.verified += 1;
      else if (document.documentStatus === "REJECTED") result.rejected += 1;
      else result.pending += 1;
      return result;
    },
    { verified: 0, pending: 0, rejected: 0 },
  );

  function closeForm() {
    setOpen(false);
    setEditingId("");
    setForm(EMPTY_FORM);
  }

  function startAdd() {
    setEditingId("");
    setForm(EMPTY_FORM);
    setOpen(true);
    setMessage("");
    setError("");
  }

  function startEdit(document: StudentDocumentRecord) {
    setEditingId(document.id);
    setForm({
      documentType: document.documentType,
      documentStatus: document.documentStatus,
      fileName: document.fileName ?? "",
      fileUrl: document.fileUrl ?? "",
      receivedAt: document.receivedAt ?? "",
      notes: document.notes ?? "",
    });
    setOpen(true);
    setMessage("");
    setError("");
  }

  async function saveDocument() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      if (form.documentStatus === "VERIFIED" && !form.fileUrl) {
        throw new Error("Upload a file before verifying this document.");
      }
      const response = await fetch(
        editingId
          ? `/api/school-students/${studentId}/documents/${editingId}`
          : `/api/school-students/${studentId}/documents`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            documentType: form.documentType,
            documentStatus: form.documentStatus,
            fileName: form.fileName.trim() || undefined,
            fileUrl: form.fileUrl || undefined,
            receivedAt: form.receivedAt || undefined,
            notes: form.notes.trim() || undefined,
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Failed to save document.");
      }
      setMessage(editingId ? "Document updated." : "Document added.");
      closeForm();
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to save document.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocumentFile(file: File) {
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("schoolId", schoolId);
      formData.append("studentId", studentId);
      formData.append("category", form.documentType.toLowerCase());

      const response = await fetch("/api/uploads/student-files", {
        method: "POST",
        body: formData,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Failed to upload document.");
      }
      setForm((current) => ({
        ...current,
        fileName: body.fileName ?? file.name,
        fileUrl: body.fileUrl,
        receivedAt: current.receivedAt || new Date().toISOString().slice(0, 10),
      }));
      setMessage("File uploaded. Save the document record.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to upload document.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function changeStatus(
    document: StudentDocumentRecord,
    status: "VERIFIED" | "REJECTED",
  ) {
    setActingId(document.id);
    setMessage("");
    setError("");
    try {
      if (status === "VERIFIED" && !document.fileUrl) {
        throw new Error("Upload a file before verifying this document.");
      }
      const response = await fetch(
        `/api/school-students/${studentId}/documents/${document.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId, documentStatus: status }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Failed to update document status.");
      }
      setMessage(
        status === "VERIFIED" ? "Document verified." : "Document rejected.",
      );
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to update document status.",
      );
    } finally {
      setActingId("");
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-950">Documents</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {documents.length}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="text-green-700">{counts.verified} verified</span>
              <span>·</span>
              <span className="text-amber-700">{counts.pending} pending</span>
              {counts.rejected ? (
                <>
                  <span>·</span>
                  <span className="text-red-700">
                    {counts.rejected} rejected
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={startAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> Add document
        </button>
      </div>

      {message ? (
        <div className="mx-5 mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {open ? (
        <div className="m-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="font-semibold text-slate-900">
              {editingId ? "Edit document" : "New document"}
            </div>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close document form"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <FieldLabel>Document type</FieldLabel>
              <select
                value={form.documentType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    documentType: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="PHOTO">Student photo</option>
                <option value="BIRTH_CERTIFICATE">Birth certificate</option>
                <option value="VACCINATION_CARD">Vaccination card</option>
                <option value="PREVIOUS_SCHOOL_RECORD">
                  Previous school record
                </option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            {editingId ? (
              <label>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={form.documentStatus}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      documentStatus: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="PENDING">Pending</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </label>
            ) : (
              <div />
            )}
            <label>
              <FieldLabel>Received date</FieldLabel>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.receivedAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    receivedAt: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label>
              <FieldLabel>File name</FieldLabel>
              <input
                maxLength={255}
                value={form.fileName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fileName: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="md:col-span-2">
              <FieldLabel>File</FieldLabel>
              <span className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-medium text-slate-600 hover:border-blue-400 hover:text-blue-700">
                <Upload className="h-4 w-4" />
                {uploading
                  ? "Uploading…"
                  : form.fileName || "Choose PDF or image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={uploading}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadDocumentFile(file);
                  }}
                />
              </span>
            </label>
            <label className="md:col-span-2">
              <FieldLabel>Notes</FieldLabel>
              <textarea
                rows={3}
                maxLength={2000}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || uploading}
              onClick={() => void saveDocument()}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save document"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3 p-5">
        {documents.map((document) => (
          <article
            key={document.id}
            className="rounded-2xl border border-slate-200 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-950">
                    {documentTypeLabel(document.documentType)}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {document.fileName ?? "No file uploaded"}
                    {document.receivedAt ? ` · ${document.receivedAt}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <SchoolBadge tone={statusTone(document.documentStatus)}>
                  {statusLabel(document.documentStatus)}
                </SchoolBadge>
                <button
                  type="button"
                  onClick={() => startEdit(document)}
                  aria-label="Edit document"
                  title="Edit document"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>
            {document.notes ? (
              <div className="mt-3 text-sm text-slate-600">
                {document.notes}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {document.fileUrl ? (
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </a>
              ) : null}
              {document.documentStatus !== "VERIFIED" ? (
                <button
                  type="button"
                  disabled={actingId === document.id || !document.fileUrl}
                  onClick={() => void changeStatus(document, "VERIFIED")}
                  title={
                    document.fileUrl ? "Verify document" : "Upload a file first"
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-medium text-green-700 disabled:opacity-40"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verify
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Verified{" "}
                  {document.verifiedAt
                    ? new Date(document.verifiedAt).toLocaleDateString()
                    : ""}
                </span>
              )}
              {document.documentStatus !== "REJECTED" ? (
                <button
                  type="button"
                  disabled={actingId === document.id}
                  onClick={() => void changeStatus(document, "REJECTED")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 disabled:opacity-40"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-red-700">
                  <XCircle className="h-3.5 w-3.5" />
                  Rejected
                </span>
              )}
              {document.documentStatus === "PENDING" ? (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-amber-700">
                  <Clock3 className="h-3.5 w-3.5" />
                  Awaiting review
                </span>
              ) : null}
            </div>
          </article>
        ))}
        {!documents.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
            <FileText className="mx-auto mb-2 h-7 w-7 text-slate-300" />
            No documents recorded
          </div>
        ) : null}
      </div>
    </section>
  );
}
