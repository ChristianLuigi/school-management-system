"use client";

import { FormEvent, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type School = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type Invitation = {
  id: string;
  school_id: string;
  school_name: string;
  school_code: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  invited_role: string;
  invitation_status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expires_at: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-green-100 text-green-700",
  EXPIRED: "bg-slate-100 text-slate-600",
  REVOKED: "bg-red-100 text-red-700",
};

type PlatformInvitationsClientProps = {
  initialSchools: School[];
};

export function PlatformInvitationsClient({
  initialSchools,
}: PlatformInvitationsClientProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
    schoolId: initialSchools[0]?.id ?? "",
    email: "",
    firstName: "",
    lastName: "",
    role: "SCHOOL_ADMIN" as "SCHOOL_ADMIN" | "TEACHER" | "FINANCE_ADMIN",
  });

  async function fetchInvitations() {
    const res = await fetch(`${API_BASE_URL}/platform/invitations`, {
      cache: "no-store",
    });
    const data = await res.json();
    setInvitations(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    setLoading(true);
    fetchInvitations()
      .catch(() => setError("Failed to load invitations."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`${API_BASE_URL}/platform/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: form.schoolId,
          email: form.email,
          firstName: form.firstName || undefined,
          lastName: form.lastName || undefined,
          role: form.role,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message ?? "Failed to create invitation.");
      }

      setSuccessMsg(
        `Invitation sent to ${form.email}${data.devToken ? ` (dev token: ${data.devToken})` : ""}.`,
      );

      setForm((prev) => ({ ...prev, email: "", firstName: "", lastName: "" }));
      await fetchInvitations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create invitation.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invitations</h1>
        <p className="mt-1 text-slate-600">
          Send school staff invitations and track their status.
        </p>
      </div>

      {/* Create invitation form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      >
        <h2 className="mb-4 text-lg font-semibold">Send New Invitation</h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">School</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.schoolId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, schoolId: e.target.value }))
              }
              required
            >
              {initialSchools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="staff@school.com"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </div>

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
              <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
              <option value="TEACHER">TEACHER</option>
              <option value="FINANCE_ADMIN">FINANCE_ADMIN</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              First Name <span className="text-slate-400">(optional)</span>
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.firstName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, firstName: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Last Name <span className="text-slate-400">(optional)</span>
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.lastName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, lastName: e.target.value }))
              }
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting || initialSchools.length === 0}
              className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {successMsg ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successMsg}
          </div>
        ) : null}
      </form>

      {/* Invitation list */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold">All Invitations</h2>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-500">Loading...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">{inv.email}</td>
                  <td className="px-4 py-3">
                    {inv.first_name || inv.last_name
                      ? `${inv.first_name ?? ""} ${inv.last_name ?? ""}`.trim()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {inv.school_name} ({inv.school_code})
                  </td>
                  <td className="px-4 py-3">{inv.invited_role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        STATUS_STYLES[inv.invitation_status] ??
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {inv.invitation_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}

              {invitations.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No invitations yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
