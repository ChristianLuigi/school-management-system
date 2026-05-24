"use client";

import { useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

export type StudentGuardianRow = {
  studentGuardianId: string;
  guardianId: string;
  relationship: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  isAuthorizedPickup: boolean;
  fullName: string;
  profession: string | null;
  phonePrimary: string | null;
  phoneSecondary: string | null;
  email: string | null;
  address: string | null;
};

function relationshipLabel(value: string) {
  const labels: Record<string, string> = {
    MOTHER: "Mother / Mere",
    FATHER: "Father / Pere",
    TUTOR: "Tutor / Tuteur",
    OTHER: "Other / Autre",
  };

  return labels[value] ?? value;
}

const emptyForm = {
  fullName: "",
  relationship: "TUTOR",
  profession: "",
  phonePrimary: "",
  phoneSecondary: "",
  email: "",
  address: "",
  isPrimaryContact: false,
  isEmergencyContact: false,
  isAuthorizedPickup: false,
};

export function StudentGuardiansPanelClient({
  schoolId,
  studentId,
  guardians,
  onChanged,
}: {
  schoolId: string;
  studentId: string;
  guardians: StudentGuardianRow[];
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

  function startEdit(guardian: StudentGuardianRow) {
    setEditingId(guardian.studentGuardianId);
    setForm({
      fullName: guardian.fullName ?? "",
      relationship: guardian.relationship ?? "OTHER",
      profession: guardian.profession ?? "",
      phonePrimary: guardian.phonePrimary ?? "",
      phoneSecondary: guardian.phoneSecondary ?? "",
      email: guardian.email ?? "",
      address: guardian.address ?? "",
      isPrimaryContact: guardian.isPrimaryContact,
      isEmergencyContact: guardian.isEmergencyContact,
      isAuthorizedPickup: guardian.isAuthorizedPickup,
    });
    setOpen(true);
    setMessage("");
    setError("");
  }

  async function saveGuardian() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!form.fullName.trim()) {
        throw new Error("Guardian full name is required.");
      }

      const payload = {
        schoolId,
        fullName: form.fullName,
        relationship: form.relationship,
        profession: form.profession || undefined,
        phonePrimary: form.phonePrimary || undefined,
        phoneSecondary: form.phoneSecondary || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        isPrimaryContact: form.isPrimaryContact,
        isEmergencyContact: form.isEmergencyContact,
        isAuthorizedPickup: form.isAuthorizedPickup,
      };

      const url = editingId
        ? `/api/school-students/${studentId}/guardians/${editingId}`
        : `/api/school-students/${studentId}/guardians`;

      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to save guardian.");
      }

      setMessage(
        editingId
          ? "Guardian updated successfully."
          : "Guardian added successfully.",
      );
      setOpen(false);
      setEditingId("");
      setForm(emptyForm);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save guardian.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Parents / Guardians
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Manage mother, father, tutor, emergency contact, and pickup authorization.
          </p>
        </div>

        <button
          type="button"
          onClick={startAdd}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add Guardian
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
            {editingId ? "Edit Guardian" : "Add Guardian"}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="Full name"
              value={form.fullName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, fullName: event.target.value }))
              }
            />

            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={form.relationship}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, relationship: event.target.value }))
              }
            >
              <option value="MOTHER">Mother / Mere</option>
              <option value="FATHER">Father / Pere</option>
              <option value="TUTOR">Tutor / Tuteur</option>
              <option value="OTHER">Other / Autre</option>
            </select>

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Profession"
              value={form.profession}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, profession: event.target.value }))
              }
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Primary phone"
              value={form.phonePrimary}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phonePrimary: event.target.value }))
              }
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Secondary phone"
              value={form.phoneSecondary}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  phoneSecondary: event.target.value,
                }))
              }
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="Email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
            />

            <textarea
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="Address"
              value={form.address}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, address: event.target.value }))
              }
            />

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPrimaryContact}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    isPrimaryContact: event.target.checked,
                  }))
                }
              />
              Primary contact
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.isEmergencyContact}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    isEmergencyContact: event.target.checked,
                  }))
                }
              />
              Emergency contact
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.isAuthorizedPickup}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    isAuthorizedPickup: event.target.checked,
                  }))
                }
              />
              Authorized to pick up the student
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={saveGuardian}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : editingId ? "Save Guardian" : "Add Guardian"}
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

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {guardians.map((guardian) => (
          <div
            key={guardian.studentGuardianId}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">
                  {guardian.fullName}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {relationshipLabel(guardian.relationship)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => startEdit(guardian)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs hover:bg-slate-50"
              >
                Edit
              </button>
            </div>

            <div className="mt-3 space-y-1 text-sm text-slate-600">
              {guardian.profession ? (
                <div>Profession: {guardian.profession}</div>
              ) : null}
              {guardian.phonePrimary ? (
                <div>Phone: {guardian.phonePrimary}</div>
              ) : null}
              {guardian.phoneSecondary ? (
                <div>Alt phone: {guardian.phoneSecondary}</div>
              ) : null}
              {guardian.email ? <div>Email: {guardian.email}</div> : null}
              {guardian.address ? <div>Address: {guardian.address}</div> : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {guardian.isPrimaryContact ? (
                <SchoolBadge tone="blue">Primary</SchoolBadge>
              ) : null}

              {guardian.isEmergencyContact ? (
                <SchoolBadge tone="red">Emergency</SchoolBadge>
              ) : null}

              {guardian.isAuthorizedPickup ? (
                <SchoolBadge tone="green">Pickup</SchoolBadge>
              ) : null}
            </div>
          </div>
        ))}

        {guardians.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 md:col-span-2">
            No parent or guardian recorded yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
