"use client";

import Link from "next/link";
import { useState } from "react";
import {
  EmptyState,
  ManagementModeBadge,
  PlatformPanel,
  PlatformPrimaryLinkButton,
  PlatformStatCard,
  StatusBadge,
} from "@/components/platform-ui";

type School = {
  id: string;
  code: string;
  name: string;
  status: string;
  management_mode: "SELF_MANAGED" | "SUPERADMIN_MANAGED" | "HYBRID_MANAGED";
  default_locale: string;
  timezone: string;
  currency_code: string;
  country_code: string;
};

type PlatformSchoolsClientProps = {
  initialSchools: School[];
};

export function PlatformSchoolsClient({
  initialSchools,
}: PlatformSchoolsClientProps) {
  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<School | null>(null);

  async function handleStatusAction(
    school: School,
    action: "activate" | "suspend" | "archive",
    newStatus: "ACTIVE" | "SUSPENDED" | "ARCHIVED",
  ) {
    setWorking(school.id);
    setError("");

    try {
      const res = await fetch(
        `/api/proxy/platform/schools/${school.id}/${action}`,
        {
          method: "POST",
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message ?? `Failed to ${action} school.`);
      }

      setSchools((prev) =>
        prev.map((s) => (s.id === school.id ? { ...s, status: newStatus } : s)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} school.`,
      );
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete(school: School) {
    setConfirmDelete(null);
    setWorking(school.id);
    setError("");

    try {
      const res = await fetch(`/api/proxy/platform/schools/${school.id}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Failed to delete school.");
      }

      setSchools((prev) => prev.filter((s) => s.id !== school.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete school.");
    } finally {
      setWorking(null);
    }
  }

  const activeCount = schools.filter((s) => s.status === "ACTIVE").length;
  const setupCount = schools.filter((s) => s.status === "ACTIVE_SETUP").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <PlatformStatCard label="Total Schools" value={schools.length} />
        <PlatformStatCard label="Active" value={activeCount} />
        <PlatformStatCard label="In Setup" value={setupCount} />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <PlatformPanel
        title="School Directory"
        subtitle="Review school status, management mode, and lifecycle controls."
      >
        {schools.length === 0 ? (
          <EmptyState
            title="No schools yet"
            description="Create the first school tenant to start operating the platform."
            action={
              <PlatformPrimaryLinkButton href="/platform/schools/new">
                Create School
              </PlatformPrimaryLinkButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Management</th>
                  <th className="px-4 py-3">Locale</th>
                  <th className="px-4 py-3">Timezone</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => {
                  const busy = working === school.id;

                  return (
                    <tr key={school.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-mono text-xs">{school.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {school.name}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={school.status} />
                      </td>
                      <td className="px-4 py-3">
                        <ManagementModeBadge mode={school.management_mode} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{school.default_locale}</td>
                      <td className="px-4 py-3 text-slate-600">{school.timezone}</td>
                      <td className="px-4 py-3 text-slate-600">{school.currency_code}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/platform/schools/${school.id}`}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Open
                          </Link>

                          {school.status === "SUSPENDED" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleStatusAction(school, "activate", "ACTIVE")
                              }
                              className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                            >
                              {busy ? "..." : "Reactivate"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleStatusAction(school, "suspend", "SUSPENDED")
                              }
                              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                            >
                              {busy ? "..." : "Suspend"}
                            </button>
                          )}

                          {school.status !== "ARCHIVED" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleStatusAction(school, "archive", "ARCHIVED")
                              }
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {busy ? "..." : "Archive"}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirmDelete(school)}
                            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Delete
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
      </PlatformPanel>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Delete school?</h2>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium">{confirmDelete.name}</span> (
              {confirmDelete.code}) will be permanently removed. This cannot be
              undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleDelete(confirmDelete)}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
