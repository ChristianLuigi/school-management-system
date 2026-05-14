"use client";

import { useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

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

const emptyForm = {
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
    OTHER: "Other",
  };

  return labels[value] ?? value;
}

function statusTone(status: string) {
  if (status === "VERIFIED") return "green";
  if (status === "REJECTED") return "red";
  return "amber";
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
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function startAdd() {
    setEditingId("");
    setForm(emptyForm);
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
      const payload = {
        schoolId,
        documentType: form.documentType,
        documentStatus: form.documentStatus,
        fileName: form.fileName || undefined,
        fileUrl: form.fileUrl || undefined,
        receivedAt: form.receivedAt || undefined,
        notes: form.notes || undefined,
      };

      const url = editingId
        ? `/api/school-students/${studentId}/documents/${editingId}`
        : `/api/school-students/${studentId}/documents`;

      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to save document.");
      }

      setMessage(
        editingId
          ? "Document updated successfully."
          : "Document added successfully.",
      );
      setOpen(false);
      setEditingId("");
      setForm(emptyForm);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Document Records
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Track documents received for the student file. File upload will come later.
          </p>
        </div>

        <button
          type="button"
          onClick={startAdd}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add Document
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
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 font-semibold text-slate-900">
            {editingId ? "Edit Document" : "Add Document"}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={form.documentType}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, documentType: event.target.value }))
              }
            >
              <option value="PHOTO">Student photo</option>
              <option value="BIRTH_CERTIFICATE">Birth certificate</option>
              <option value="VACCINATION_CARD">Vaccination card</option>
              <option value="PREVIOUS_SCHOOL_RECORD">Previous school record</option>
              <option value="OTHER">Other</option>
            </select>

            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={form.documentStatus}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, documentStatus: event.target.value }))
              }
            >
              <option value="PENDING">Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="File name"
              value={form.fileName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, fileName: event.target.value }))
              }
            />

            <input
              type="date"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={form.receivedAt}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, receivedAt: event.target.value }))
              }
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="File URL or reference"
              value={form.fileUrl}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, fileUrl: event.target.value }))
              }
            />

            <textarea
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="Notes"
              value={form.notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value }))
              }
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={saveDocument}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : editingId ? "Save Document" : "Add Document"}
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditingId("");
                setForm(emptyForm);
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {documents.map((document) => (
          <div
            key={document.id}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">
                  {documentTypeLabel(document.documentType)}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {document.fileName ?? "No file name"}
                  {document.receivedAt ? ` - Received: ${document.receivedAt}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <SchoolBadge tone={statusTone(document.documentStatus) as any}>
                  {document.documentStatus}
                </SchoolBadge>

                <button
                  type="button"
                  onClick={() => startEdit(document)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                >
                  Edit
                </button>
              </div>
            </div>

            {document.fileUrl ? (
              <a
                href={document.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs hover:bg-slate-50"
              >
                Open File
              </a>
            ) : null}

            {document.notes ? (
              <div className="mt-3 text-sm text-slate-600">
                {document.notes}
              </div>
            ) : null}
          </div>
        ))}

        {documents.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No document records added yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
