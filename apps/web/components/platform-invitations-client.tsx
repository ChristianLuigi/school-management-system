"use client";

import { FormEvent, useEffect, useState } from "react";

type School = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type StaffMember = {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  user_status: string;
  membership_status: string;
  roles: string[];
};

type CreatedAccount = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  tempPassword: string;
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
  FINANCE_ADMIN: "Finance Admin",
};

function normalizeRoles(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value !== "string") {
    return [];
  }

  const raw = value.trim();

  if (!raw) {
    return [];
  }

  if (raw.startsWith("{") && raw.endsWith("}")) {
    const body = raw.slice(1, -1).trim();

    if (!body) {
      return [];
    }

    return body
      .split(",")
      .map((entry) => entry.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }

  return [raw];
}

function normalizeStaff(data: unknown): StaffMember[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;

      if (typeof row.user_id !== "string" || typeof row.email !== "string") {
        return null;
      }

      return {
        user_id: row.user_id,
        email: row.email,
        first_name: typeof row.first_name === "string" ? row.first_name : null,
        last_name: typeof row.last_name === "string" ? row.last_name : null,
        user_status: typeof row.user_status === "string" ? row.user_status : "",
        membership_status:
          typeof row.membership_status === "string" ? row.membership_status : "",
        roles: normalizeRoles(row.roles),
      };
    })
    .filter((entry): entry is StaffMember => Boolean(entry));
}

export function PlatformInvitationsClient({
  initialSchools,
}: {
  initialSchools: School[];
}) {
  const [selectedSchoolId, setSelectedSchoolId] = useState(
    initialSchools[0]?.id ?? ""
  );
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    temporaryPassword: "",
    role: "TEACHER" as "SCHOOL_ADMIN" | "TEACHER" | "FINANCE_ADMIN",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedAccount | null>(null);

  useEffect(() => {
    if (!selectedSchoolId) return;

    setLoadingStaff(true);
    setStaff([]);

    fetch(`/api/proxy/platform/schools/${selectedSchoolId}/staff`)
      .then((r) => r.json())
      .then((data) => setStaff(normalizeStaff(data)))
      .catch(() => setStaff([]))
      .finally(() => setLoadingStaff(false));
  }, [selectedSchoolId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCreated(null);
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/proxy/platform/schools/${selectedSchoolId}/staff`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email.trim().toLowerCase(),
            firstName: form.firstName.trim() || undefined,
            lastName: form.lastName.trim() || undefined,
            temporaryPassword: form.temporaryPassword,
            role: form.role,
          }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message ?? "Failed to create account.");
      }

      setCreated({
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        tempPassword: form.temporaryPassword,
        role: form.role,
      });

      const refreshed = await fetch(
        `/api/proxy/platform/schools/${selectedSchoolId}/staff`
      ).then((r) => r.json());
      setStaff(normalizeStaff(refreshed));

      setForm((prev) => ({
        ...prev,
        email: "",
        firstName: "",
        lastName: "",
        temporaryPassword: "",
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create account."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSchool = initialSchools.find((s) => s.id === selectedSchoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Staff Management</h1>
        <p className="mt-1 text-slate-600">
          Create accounts for school admins, teachers, and finance admins.
          Credentials are set once and shared directly with the user.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Select School
        </label>
        {initialSchools.length === 0 ? (
          <p className="text-sm text-slate-500">
            No schools yet. Create one first.
          </p>
        ) : (
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={selectedSchoolId}
            onChange={(e) => {
              setSelectedSchoolId(e.target.value);
              setCreated(null);
              setError("");
            }}
          >
            {initialSchools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code}) - {s.status}
              </option>
            ))}
          </select>
        )}
      </div>

      {created && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="text-sm font-semibold text-green-700">
            Account created - share these credentials with the user
          </div>
          <div className="rounded-xl bg-white ring-1 ring-green-200 p-4 grid gap-2 text-sm">
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Role</span>
              <span className="font-medium">
                {ROLE_LABELS[created.role] ?? created.role}
              </span>
            </div>
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Email</span>
              <span className="font-mono font-medium">{created.email}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Temporary Password</span>
              <span className="font-mono font-medium">
                {created.tempPassword}
              </span>
            </div>
          </div>
          <p className="text-xs text-amber-700">
            This password is shown once. Copy it now before creating another
            account.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 text-lg font-semibold">Create Account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Role</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    role: e.target.value as typeof form.role,
                  }))
                }
              >
                <option value="TEACHER">Teacher</option>
                <option value="FINANCE_ADMIN">Finance Admin</option>
                <option value="SCHOOL_ADMIN">School Admin</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="teacher@school.com"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  First Name{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Marie"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Last Name{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Pierre"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Temporary Password
              </label>
              <input
                type="text"
                required
                minLength={8}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="At least 8 characters"
                value={form.temporaryPassword}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    temporaryPassword: e.target.value,
                  }))
                }
              />
              <p className="mt-1 text-xs text-slate-500">
                The user logs in with this on first access.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedSchoolId}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create Account"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 text-lg font-semibold">
            {selectedSchool ? `${selectedSchool.name} - Staff` : "Staff"}
          </h2>

          {loadingStaff ? (
            <p className="text-sm text-slate-500">Loading staff...</p>
          ) : staff.length === 0 ? (
            <p className="text-sm text-slate-500">
              No staff accounts yet for this school.
            </p>
          ) : (
            <div className="space-y-2">
              {staff.map((member) => (
                <div
                  key={member.user_id}
                  className="rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">
                        {member.first_name || member.last_name
                          ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()
                          : "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {member.email}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {member.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {ROLE_LABELS[role] ?? role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}