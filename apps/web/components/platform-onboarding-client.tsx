"use client";


import { platformErrorKey } from "@/lib/i18n/platform-copy";
import { usePlatformCopy } from "@/components/use-platform-copy";
import { ListPagination, useListPage } from "@/components/list-pagination";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
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

function formatLastActivity(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString(locale === "fr" ? "fr-HT" : "en-US");
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
  const pt = usePlatformCopy();
  const { locale } = useI18n();

  const [data, setData] = useState<ResponseShape | null>(null);
  const onboardingPage = useListPage(data?.rows ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [status, setStatus] = useState(initialStatus);
  const [managementMode, setManagementMode] = useState(initialManagementMode);
  const [attentionOnly, setAttentionOnly] = useState(initialAttentionOnly);
  const [search, setSearch] = useState(initialSearch);
  const latestRequest = useRef(0);

  async function loadData(nextSearch = search) {
    const requestId = ++latestRequest.current;
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

      if (requestId === latestRequest.current) setData(normalizeResponse(body));
    } catch (err) {
      if (requestId === latestRequest.current) setError(
        err instanceof Error ? err.message : "Failed to load onboarding data.",
      );
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    return () => { latestRequest.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, managementMode, attentionOnly]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-danger/40 bg-danger-subtle p-4 text-sm text-danger">
          {pt(platformErrorKey(error))}
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-4 md:grid-cols-4">
          <PlatformStatCard label={pt("Tracked Schools")} value={data.summary.totalSchools} />
          <PlatformStatCard
            label={pt("Need Attention")}
            value={data.summary.needingAttention}
          />
          <PlatformStatCard label={pt("Complete")} value={data.summary.complete} />
          <PlatformStatCard
            label={pt("Admin Not Logged In")}
            value={data.summary.adminNotLoggedIn}
          />
        </div>
      ) : null}

      <PlatformPanel
        title={pt("Filters")}
        subtitle={pt("Refine the onboarding tracker by status, management mode, or attention needs.")}
      >
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-input bg-surface text-foreground px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{pt("All statuses")}</option>
            <option value="ACTIVE">{pt("ACTIVE")}</option>
            <option value="ACTIVE_SETUP">{pt("ACTIVE_SETUP")}</option>
            <option value="SUSPENDED">{pt("SUSPENDED")}</option>
            <option value="ARCHIVED">{pt("ARCHIVED")}</option>
          </select>

          <select
            className="rounded-xl border border-input bg-surface text-foreground px-3 py-2"
            value={managementMode}
            onChange={(e) => setManagementMode(e.target.value)}
          >
            <option value="">{pt("All management modes")}</option>
            <option value="SELF_MANAGED">{pt("SELF_MANAGED")}</option>
            <option value="SUPERADMIN_MANAGED">{pt("SUPERADMIN_MANAGED")}</option>
            <option value="HYBRID_MANAGED">{pt("HYBRID_MANAGED")}</option>
          </select>

          <input
            className="rounded-xl border border-input bg-surface text-foreground px-3 py-2"
            placeholder={pt("Search school")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <label className="flex items-center gap-2 rounded-xl border border-input bg-surface text-foreground px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(e) => setAttentionOnly(e.target.checked)}
            />{pt("Attention only")}{" "}</label>

          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-xl border border-input bg-surface text-foreground px-4 py-2 hover:bg-surface-muted"
          >{pt("Apply")}{" "}</button>
        </div>
      </PlatformPanel>

      <PlatformPanel
        title={pt("Onboarding Tracker")}
        subtitle={pt("Review completion progress, missing setup pieces, and intervention needs.")}
      >
        {loading ? (
          <div className="rounded-2xl bg-surface-muted p-6 text-center text-muted-foreground">{pt("Loading onboarding data...")}{" "}</div>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            title={pt("No schools found")}
            description={pt("No schools match the current onboarding filters.")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{pt("School")}</th>
                  <th className="px-4 py-3">{pt("Status")}</th>
                  <th className="px-4 py-3">{pt("Mode")}</th>
                  <th className="px-4 py-3">{pt("Completion")}</th>
                  <th className="px-4 py-3">{pt("Admin")}</th>
                  <th className="px-4 py-3">{pt("Setup")}</th>
                  <th className="px-4 py-3">{pt("Action Needed")}</th>
                  <th className="px-4 py-3">{pt("Last Activity")}</th>
                  <th className="px-4 py-3">{pt("Open")}</th>
                </tr>
              </thead>
              <tbody>
                {onboardingPage.items.map((row) => (
                  <tr key={row.schoolId} className="border-t border-border">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">{row.schoolName}</div>
                      <div className="text-muted-foreground">{row.schoolCode}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={row.schoolStatus} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <ManagementModeBadge mode={row.managementMode} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="min-w-[140px]">
                        <div className="mb-1 text-xs text-muted-foreground">
                          {row.completionPercent}%
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${
                              row.completionPercent === 100
                                ? "bg-success"
                                : row.completionPercent >= 50
                                  ? "bg-warning-subtle0"
                                  : "bg-danger-subtle0"
                            }`}
                            style={{ width: `${row.completionPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.schoolAdmins}{" "}{pt("admin(s) /")}{" "}{row.adminLogins}{" "}{pt("logged in")}{" "}</td>
                    <td className="px-4 py-3 align-top">
                      L:{row.levels} · Y:{row.academicYears} · P:{row.gradingPeriods} ·
                      G:{row.gradeLevels} · S:{row.sections}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <PlatformBadge tone={row.needsAttention ? "amber" : "green"}>
                        {pt(row.actionNeeded)}
                      </PlatformBadge>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {formatLastActivity(row.lastActivityAt, locale)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/platform/schools/${row.schoolId}`}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
                      >{pt("Open")}{" "}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListPagination {...onboardingPage} disabled={loading} />
          </div>
        )}
      </PlatformPanel>
    </div>
  );
}
