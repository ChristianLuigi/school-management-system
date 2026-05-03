"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  EmptyState,
  PlatformBadge,
  PlatformPanel,
} from "@/components/platform-ui";

type School = {
  id: string;
  name: string;
  code: string;
};

type StaffRow = {
  membership_id: string;
  school_id: string;
  school_name: string;
  school_code: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  membership_status: string;
  job_title: string | null;
  roles: string[];
};

type Props = {
  schools: School[];
  initialSchoolId?: string;
  initialRole?: string;
  initialStatus?: string;
};

const ROLE_LABELS: Record<string, string> = {
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
  FINANCE_ADMIN: "Finance Admin",
};

function statusTone(status: string): "green" | "amber" | "blue" | "neutral" {
  if (status === "ACTIVE") {
    return "green";
  }

  if (status === "SUSPENDED") {
    return "amber";
  }

  if (status === "INVITED") {
    return "blue";
  }

  return "neutral";
}

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

function normalizeRows(data: unknown): StaffRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;

      if (
        typeof row.membership_id !== "string" ||
        typeof row.school_id !== "string" ||
        typeof row.user_id !== "string" ||
        typeof row.email !== "string"
      ) {
        return null;
      }

      return {
        membership_id: row.membership_id,
        school_id: row.school_id,
        school_name: typeof row.school_name === "string" ? row.school_name : "",
        school_code: typeof row.school_code === "string" ? row.school_code : "",
        user_id: row.user_id,
        email: row.email,
        first_name: typeof row.first_name === "string" ? row.first_name : null,
        last_name: typeof row.last_name === "string" ? row.last_name : null,
        membership_status:
          typeof row.membership_status === "string" ? row.membership_status : "",
        job_title: typeof row.job_title === "string" ? row.job_title : null,
        roles: normalizeRoles(row.roles),
      };
    })
    .filter((entry): entry is StaffRow => Boolean(entry));
}

export function PlatformStaffClient({
  schools,
  initialSchoolId = "",
  initialRole = "",
  initialStatus = "",
}: Props) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  const [filters, setFilters] = useState({
    schoolId: initialSchoolId,
    role: initialRole,
    status: initialStatus,
    search: "",
  });

  const [form, setForm] = useState({
    schoolId: initialSchoolId || schools[0]?.id || "",
    email: "",
    firstName: "",
    lastName: "",
    role: "TEACHER",
    jobTitle: "",
  });

  async function loadStaff(nextFilters = filters) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (nextFilters.schoolId) params.set("schoolId", nextFilters.schoolId);
      if (nextFilters.role) params.set("role", nextFilters.role);
      if (nextFilters.status) params.set("status", nextFilters.status);
      if (nextFilters.search.trim()) params.set("search", nextFilters.search.trim());

      const query = params.toString();
      const res = await fetch(
        `/api/proxy/platform/staff${query ? `?${query}` : ""}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load staff.");
      }

      setRows(normalizeRows(body));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createStaff(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    setTempPassword("");

    try {
      const payload = {
        schoolId: form.schoolId,
        email: form.email.trim().toLowerCase(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role,
        jobTitle: form.jobTitle.trim() || undefined,
      };

      const res = await fetch("/api/proxy/platform/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create staff.");
      }

      setMessage(`Staff account created for ${body.user.email}`);
      setTempPassword(body.temporaryPassword ?? "");
      setForm({
        schoolId: form.schoolId,
        email: "",
        firstName: "",
        lastName: "",
        role: "TEACHER",
        jobTitle: "",
      });

      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create staff.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(
    membershipId: string,
    action: "suspend" | "reactivate" | "reset-password",
  ) {
    setActingId(membershipId);
    setError("");
    setMessage("");
    setTempPassword("");

    try {
      const res = await fetch(`/api/proxy/platform/staff/${membershipId}/${action}`, {
        method: "POST",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? `Failed to ${action}.`);
      }

      if (action === "reset-password") {
        setMessage(`Temporary password reset for ${body.email}`);
        setTempPassword(body.temporaryPassword ?? "");
      } else {
        setMessage(
          action === "suspend"
            ? "Membership suspended successfully."
            : "Membership reactivated successfully.",
        );
      }

      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}.`);
    } finally {
      setActingId(null);
    }
  }

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    void loadStaff(filters);
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <div>{message}</div>
          {tempPassword ? (
            <div className="mt-3 rounded-xl bg-white p-3 font-mono text-sm text-slate-900 ring-1 ring-green-200">
              {tempPassword}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <PlatformPanel
          title="Create Staff"
          subtitle="Accounts are activated immediately and return a temporary password once."
        >
          <form onSubmit={createStaff} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                School
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                value={form.schoolId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, schoolId: e.target.value }))
                }
                required
              >
                <option value="">Select school</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="teacher@school.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  First Name
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Marie"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Last Name
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Pierre"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Role
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="SCHOOL_ADMIN">School Admin</option>
                  <option value="TEACHER">Teacher</option>
                  <option value="FINANCE_ADMIN">Finance Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Job Title
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Math Teacher"
                  value={form.jobTitle}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, jobTitle: e.target.value }))
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || schools.length === 0}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create Staff"}
            </button>
          </form>
        </PlatformPanel>

        <PlatformPanel
          title="Staff Directory"
          subtitle="Search and manage staff memberships across school tenants."
        >
          <div className="space-y-4">
            <form onSubmit={applyFilters} className="flex flex-wrap gap-3">
              <select
                className="rounded-xl border border-slate-300 px-3 py-2"
                value={filters.schoolId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, schoolId: e.target.value }))
                }
              >
                <option value="">All schools</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>

              <select
                className="rounded-xl border border-slate-300 px-3 py-2"
                value={filters.role}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, role: e.target.value }))
                }
              >
                <option value="">All roles</option>
                <option value="SCHOOL_ADMIN">School Admin</option>
                <option value="TEACHER">Teacher</option>
                <option value="FINANCE_ADMIN">Finance Admin</option>
              </select>

              <select
                className="rounded-xl border border-slate-300 px-3 py-2"
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="INVITED">Invited</option>
                <option value="REMOVED">Removed</option>
              </select>

              <input
                className="min-w-48 flex-1 rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Search name or email"
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
              />

              <button
                type="submit"
                className="rounded-xl border border-slate-300 px-4 py-2 hover:bg-slate-50"
              >
                Apply
              </button>
            </form>

            {loading ? (
              <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
                Loading staff...
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                title="No staff found"
                description="Try widening the filters or create a new staff account."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Staff</th>
                      <th className="px-4 py-3">School</th>
                      <th className="px-4 py-3">Roles</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const busy = actingId === row.membership_id;
                      const fullName = [row.first_name, row.last_name]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <tr key={row.membership_id} className="border-t border-slate-200">
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-slate-900">{fullName || "-"}</div>
                            <div className="text-slate-500">{row.email}</div>
                            {row.job_title ? (
                              <div className="mt-1 text-xs text-slate-400">{row.job_title}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top">
                            {row.school_name} ({row.school_code})
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap gap-1">
                              {row.roles.length > 0 ? (
                                row.roles.map((role) => (
                                  <PlatformBadge key={role}>
                                    {ROLE_LABELS[role] ?? role}
                                  </PlatformBadge>
                                ))
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <PlatformBadge tone={statusTone(row.membership_status)}>
                              {row.membership_status}
                            </PlatformBadge>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap gap-2">
                              {row.membership_status === "ACTIVE" ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runAction(row.membership_id, "suspend")}
                                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                >
                                  {busy ? "Working..." : "Suspend"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runAction(row.membership_id, "reactivate")}
                                  className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
                                >
                                  {busy ? "Working..." : "Reactivate"}
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => runAction(row.membership_id, "reset-password")}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
                              >
                                {busy ? "Working..." : "Reset Password"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </PlatformPanel>
      </div>
    </div>
  );
}

