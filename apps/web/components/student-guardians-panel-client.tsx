"use client";

import { PaginatedCollection } from "@/components/paginated-collection";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
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
    MOTHER: "Mother",
    FATHER: "Father",
    TUTOR: "Guardian",
    OTHER: "Other",
  };
  return labels[value] ?? value;
}

function newGuardianForm(primary = false) {
  return {
    fullName: "",
    relationship: "TUTOR",
    profession: "",
    phonePrimary: "",
    phoneSecondary: "",
    email: "",
    address: "",
    isPrimaryContact: primary,
    isEmergencyContact: false,
    isAuthorizedPickup: false,
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-foreground">
      {children}
    </span>
  );
}

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
  const [form, setForm] = useState(() => newGuardianForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  const editingGuardian = guardians.find(
    (guardian) => guardian.studentGuardianId === editingId,
  );
  const hasPrimaryContact = guardians.some(
    (guardian) => guardian.isPrimaryContact,
  );

  function closeForm() {
    setOpen(false);
    setEditingId("");
    setForm(newGuardianForm());
  }

  function startAdd() {
    setEditingId("");
    setForm(newGuardianForm(guardians.length === 0));
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
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!form.fullName.trim()) {
        throw new Error("Guardian full name is required.");
      }
      if (
        (form.isPrimaryContact || form.isEmergencyContact) &&
        !form.phonePrimary.trim() &&
        !form.phoneSecondary.trim() &&
        !form.email.trim()
      ) {
        throw new Error(
          "Primary and emergency contacts require a phone number or email.",
        );
      }

      const response = await fetch(
        editingId
          ? `/api/school-students/${studentId}/guardians/${editingId}`
          : `/api/school-students/${studentId}/guardians`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            fullName: form.fullName.trim(),
            relationship: form.relationship,
            profession: form.profession.trim() || undefined,
            phonePrimary: form.phonePrimary.trim() || undefined,
            phoneSecondary: form.phoneSecondary.trim() || undefined,
            email: form.email.trim() || undefined,
            address: form.address.trim() || undefined,
            isPrimaryContact: form.isPrimaryContact,
            isEmergencyContact: form.isEmergencyContact,
            isAuthorizedPickup: form.isAuthorizedPickup,
          }),
        },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message ?? "Failed to save guardian.");
      }

      setMessage(editingId ? "Guardian updated." : "Guardian added.");
      closeForm();
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to save guardian.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-info-subtle p-2.5 text-info">
            <UsersRound className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">Guardians</h3>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {guardians.length}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Contacts and pickup access
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={startAdd}
          disabled={saving || open}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary"
        >
          <Plus className="h-4 w-4" />
          Add guardian
        </button>
      </div>

      {message ? (
        <div
          role="status"
          className="mx-5 mt-4 rounded-xl border border-success/40 bg-success-subtle px-4 py-3 text-sm text-success"
        >
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mx-5 mt-4 rounded-xl border border-danger/40 bg-danger-subtle px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}
      {guardians.length > 0 && !hasPrimaryContact ? (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-subtle px-4 py-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Select a primary contact.
        </div>
      ) : null}

      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveGuardian();
          }}
          className="m-5 rounded-2xl border border-border bg-surface p-4"
        >
          <fieldset disabled={saving}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <UserRound className="h-4 w-4 text-info" />
                {editingId ? "Edit guardian" : "New guardian"}
              </div>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close guardian form"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <FieldLabel>Full name *</FieldLabel>
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={form.fullName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm"
                />
              </label>
              <label>
                <FieldLabel>Relationship</FieldLabel>
                <select
                  value={form.relationship}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      relationship: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm"
                >
                  <option value="MOTHER">Mother</option>
                  <option value="FATHER">Father</option>
                  <option value="TUTOR">Guardian</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>
                <FieldLabel>Profession</FieldLabel>
                <input
                  maxLength={160}
                  value={form.profession}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      profession: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm"
                />
              </label>
              <label>
                <FieldLabel>Primary phone</FieldLabel>
                <input
                  type="tel"
                  maxLength={50}
                  value={form.phonePrimary}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phonePrimary: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm"
                />
              </label>
              <label>
                <FieldLabel>Secondary phone</FieldLabel>
                <input
                  type="tel"
                  maxLength={50}
                  value={form.phoneSecondary}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phoneSecondary: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm"
                />
              </label>
              <label className="md:col-span-2">
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  maxLength={255}
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm"
                />
              </label>
              <label className="md:col-span-2">
                <FieldLabel>Address</FieldLabel>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={form.address}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  className="w-full resize-y rounded-xl border border-input bg-surface px-3 py-2.5 text-sm"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                {
                  key: "isPrimaryContact",
                  label: "Primary",
                  disabled:
                    Boolean(editingGuardian?.isPrimaryContact) ||
                    (!editingId && guardians.length === 0),
                  icon: UserRound,
                },
                {
                  key: "isEmergencyContact",
                  label: "Emergency",
                  disabled: false,
                  icon: ShieldCheck,
                },
                {
                  key: "isAuthorizedPickup",
                  label: "Pickup",
                  disabled: false,
                  icon: Check,
                },
              ].map((option) => {
                const Icon = option.icon;
                const checked = form[
                  option.key as keyof typeof form
                ] as boolean;
                return (
                  <label
                    key={option.key}
                    className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={option.disabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [option.key]: event.target.checked,
                        }))
                      }
                    />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {option.label}
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-input px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save guardian"}
              </button>
            </div>
          </fieldset>
        </form>
      ) : null}

      <div className="grid gap-3 p-5 md:grid-cols-2">
        {<PaginatedCollection items={guardians}>{(guardian) => (
          <article
            key={guardian.studentGuardianId}
            className="rounded-2xl border border-border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground">
                  {guardian.fullName}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {relationshipLabel(guardian.relationship)}
                  {guardian.profession ? ` · ${guardian.profession}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => startEdit(guardian)}
                disabled={saving || open}
                aria-label={`Edit ${guardian.fullName}`}
                title="Edit guardian"
                className="rounded-lg p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              {guardian.phonePrimary ? (
                <a
                  href={`tel:${guardian.phonePrimary}`}
                  className="flex items-center gap-2 hover:text-info"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {guardian.phonePrimary}
                </a>
              ) : null}
              {guardian.email ? (
                <a
                  href={`mailto:${guardian.email}`}
                  className="flex items-center gap-2 truncate hover:text-info"
                >
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{guardian.email}</span>
                </a>
              ) : null}
              {guardian.address ? (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{guardian.address}</span>
                </div>
              ) : null}
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
          </article>
        )}</PaginatedCollection>}
        {!guardians.length ? (
          <div className="rounded-xl border border-dashed border-input px-4 py-10 text-center text-sm text-muted-foreground md:col-span-2">
            <UsersRound className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            No guardian recorded
          </div>
        ) : null}
      </div>
    </section>
  );
}
