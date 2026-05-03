"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EmptyState,
  ManagementModeBadge,
  PlatformBadge,
  PlatformPanel,
  PlatformStatCard,
  StatusBadge,
} from "@/components/platform-ui";

type Row = {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  schoolStatus: string;
  managementMode: string;
  schoolAdmins: number;
  adminLogins: number;
  levels: number;
  academicYears: number;
  gradingPeriods: number;
  gradeLevels: number;
  sections: number;
  completionPercent: number;
  actionNeeded: string;
  needsAttention: boolean;
  lastActivityAt: string | null;
};

type ResponseShape = {
  summary: {
    totalSchools: number;
    needingAttention: number;
    complete: number;
    adminNotLoggedIn: number;
  };
  rows: Row[];
};

type Props = {
  initialStatus?: string;
  initialManagementMode?: string;
  initialAttentionOnly?: boolean;
  initialSearch?: string;
};

function formatLastActivity(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function normalizeResponse(data: unknown): ResponseShape | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const value = data as Record<string, unknown>;
  const summary = value.summary as Record<string, unknown> | undefined;
  const rows = Array.isArray(value.rows) ? value.rows : [];

  return {
    summary: {
      totalSchools: typeof summary?.totalSchools === "number" ? summary.totalSchools : 0,
      needingAttention:
        typeof summary?.needingAttention === "number" ? summary.needingAttention : 0,
      complete: typeof summary?.complete === "number" ? summary.complete : 0,
      adminNotLoggedIn:
        typeof summary?.adminNotLoggedIn === "number" ? summary.adminNotLoggedIn : 0,
    },
    rows: rows.filter((row): row is Row => Boolean(row && typeof row === "object")) as Row[],
  };
}

export function PlatformOnboardingClient({
  initialStatus = "",
  initialManagementMode = "",
  initialAttentionOnly = false,
  initialSearch = "",
}: Props) {
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [status, setStatus] = useState(initialStatus);
  const [managementMode, setManagementMode] = useState(initialManagementMode);
  const [attentionOnly, setAttentionOnly] = useState(initialAttentionOnly);
  const [search, setSearch] = useState(initialSearch);

  async function loadData(nextSearch = search) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (managementMode) params.set("managementMode", managementMode);
      if (attentionOnly) params.set("attentionOnly", "true");
      if (nextSearch.trim()) params.set("search", nextSearch.trim());

      const query = params.toString();
      const res = await fetch(
        `/api/proxy/platform/onboarding${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load onboarding data.");
      }

      setData(normalizeResponse(body));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load onboarding data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, managementMode, attentionOnly]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-4 md:grid-cols-4">
          <PlatformStatCard label="Tracked Schools" value={data.summary.totalSchools} />
          <PlatformStatCard
            label="Need Attention"
            value={data.summary.needingAttention}
          />
          <PlatformStatCard label="Complete" value={data.summary.complete} />
          <PlatformStatCard
            label="Admin Not Logged In"
            value={data.summary.adminNotLoggedIn}
          />
        </div>
      ) : null}

      <PlatformPanel
        title="Filters"
        subtitle="Refine the onboarding tracker by status, management mode, or attention needs."
      >
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ACTIVE_SETUP">ACTIVE_SETUP</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>

          <select
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={managementMode}
            onChange={(e) => setManagementMode(e.target.value)}
          >
            <option value="">All management modes</option>
            <option value="SELF_MANAGED">SELF_MANAGED</option>
            <option value="SUPERADMIN_MANAGED">SUPERADMIN_MANAGED</option>
            <option value="HYBRID_MANAGED">HYBRID_MANAGED</option>
          </select>

          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Search school"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(e) => setAttentionOnly(e.target.checked)}
            />
            Attention only
          </label>

          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-xl border border-slate-300 px-4 py-2 hover:bg-slate-50"
          >
            Apply
          </button>
        </div>
      </PlatformPanel>

      <PlatformPanel
        title="Onboarding Tracker"
        subtitle="Review completion progress, missing setup pieces, and intervention needs."
      >
        {loading ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
            Loading onboarding data...
          </div>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            title="No schools found"
            description="No schools match the current onboarding filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Completion</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Setup</th>
                  <th className="px-4 py-3">Action Needed</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.schoolId} className="border-t border-slate-200">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">{row.schoolName}</div>
                      <div className="text-slate-500">{row.schoolCode}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={row.schoolStatus} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <ManagementModeBadge mode={row.managementMode} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="min-w-[140px]">
                        <div className="mb-1 text-xs text-slate-600">
                          {row.completionPercent}%
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              row.completionPercent === 100
                                ? "bg-green-600"
                                : row.completionPercent >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${row.completionPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.schoolAdmins} admin(s) / {row.adminLogins} logged in
                    </td>
                    <td className="px-4 py-3 align-top">
                      L:{row.levels} · Y:{row.academicYears} · P:{row.gradingPeriods} ·
                      G:{row.gradeLevels} · S:{row.sections}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <PlatformBadge tone={row.needsAttention ? "amber" : "green"}>
                        {row.actionNeeded}
                      </PlatformBadge>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {formatLastActivity(row.lastActivityAt)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/platform/schools/${row.schoolId}`}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PlatformPanel>
    </div>
  );
}
