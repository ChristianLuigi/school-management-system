"use client";

import { useEffect, useState } from "react";
import {
  EmptyState,
  PlatformBadge,
  PlatformPanel,
  PlatformStatCard,
} from "@/components/platform-ui";

type ActivityRow = {
  id: string;
  event_type: string;
  actor_type: string;
  actor_user_id: string | null;
  school_id: string | null;
  school_name: string | null;
  membership_id: string | null;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type Summary = {
  total7d: number;
  schoolCreations7d: number;
  staffCreations7d: number;
  passwordResets7d: number;
  statusChanges7d: number;
};

type School = {
  id: string;
  name: string;
  code: string;
};

type Props = {
  schools: School[];
  initialSchoolId?: string;
  initialEventType?: string;
};

function normalizeActivityRows(data: unknown): ActivityRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(
    (entry): entry is ActivityRow => Boolean(entry && typeof entry === "object"),
  );
}

function normalizeSummary(data: unknown): Summary | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as Record<string, unknown>;

  return {
    total7d: typeof row.total7d === "number" ? row.total7d : 0,
    schoolCreations7d:
      typeof row.schoolCreations7d === "number" ? row.schoolCreations7d : 0,
    staffCreations7d:
      typeof row.staffCreations7d === "number" ? row.staffCreations7d : 0,
    passwordResets7d:
      typeof row.passwordResets7d === "number" ? row.passwordResets7d : 0,
    statusChanges7d:
      typeof row.statusChanges7d === "number" ? row.statusChanges7d : 0,
  };
}

export function PlatformActivityClient({
  schools,
  initialSchoolId = "",
  initialEventType = "",
}: Props) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [schoolId, setSchoolId] = useState(initialSchoolId);
  const [eventType, setEventType] = useState(initialEventType);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (schoolId) params.set("schoolId", schoolId);
      if (eventType.trim()) params.set("eventType", eventType.trim());

      const [activityRes, summaryRes] = await Promise.all([
        fetch(`/api/proxy/platform/activity?${params.toString()}`, {
          cache: "no-store",
        }),
        fetch(`/api/proxy/platform/activity/summary`, {
          cache: "no-store",
        }),
      ]);

      const activityBody = await activityRes.json().catch(() => null);
      const summaryBody = await summaryRes.json().catch(() => null);

      if (!activityRes.ok) {
        throw new Error(activityBody?.message ?? "Failed to load activity.");
      }

      if (!summaryRes.ok) {
        throw new Error(summaryBody?.message ?? "Failed to load activity summary.");
      }

      setRows(normalizeActivityRows(activityBody));
      setSummary(normalizeSummary(summaryBody));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, eventType]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-4 md:grid-cols-5">
          <PlatformStatCard label="Total Events (7d)" value={summary.total7d} />
          <PlatformStatCard
            label="School Creations"
            value={summary.schoolCreations7d}
          />
          <PlatformStatCard label="Staff Creations" value={summary.staffCreations7d} />
          <PlatformStatCard
            label="Password Resets"
            value={summary.passwordResets7d}
          />
          <PlatformStatCard label="Status Changes" value={summary.statusChanges7d} />
        </div>
      ) : null}

      <PlatformPanel title="Filters" subtitle="Narrow the feed by school or event type.">
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
          >
            <option value="">All schools</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name} ({school.code})
              </option>
            ))}
          </select>

          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Event type (optional)"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          />

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
        title="Recent Platform Activity"
        subtitle="Latest school operations, lifecycle changes, support actions, and managed workspace entry."
      >
        {loading ? (
          <div className="rounded-xl bg-slate-50 p-4 text-slate-500">
            Loading activity...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No activity found"
            description="Platform events will appear here as actions happen."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {row.summary}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                  <PlatformBadge>{row.event_type}</PlatformBadge>
                  <PlatformBadge tone="neutral">{row.actor_type}</PlatformBadge>
                  {row.school_name ? (
                    <PlatformBadge tone="blue">{row.school_name}</PlatformBadge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </PlatformPanel>
    </div>
  );
}
