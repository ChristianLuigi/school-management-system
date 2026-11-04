"use client";


import { platformErrorKey, platformFr } from "@/lib/i18n/platform-copy";
import { usePlatformCopy } from "@/components/use-platform-copy";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { PlatformAuditSummary } from "@/components/platform-audit-summary";
import { ListPagination } from "@/components/list-pagination";
import { LIST_PAGE_SIZE } from "@/lib/list-pagination";
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
  const pt = usePlatformCopy();
  const { locale } = useI18n();

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [schoolId, setSchoolId] = useState(initialSchoolId);
  const [eventType, setEventType] = useState(initialEventType);
  const latestRequest = useRef(0);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [appliedEventType, setAppliedEventType] = useState(initialEventType);

  async function loadData(nextPage = 0, applyFilters = false) {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError("");
    if (applyFilters) { setRows([]); setPage(0); setHasNext(false); }

    try {
      const params = new URLSearchParams();
      params.set("limit", String(LIST_PAGE_SIZE + 1));
      params.set("offset", String(nextPage * LIST_PAGE_SIZE));
      if (schoolId) params.set("schoolId", schoolId);
      const nextEventType = applyFilters ? eventType.trim() : appliedEventType;
      if (nextEventType) params.set("eventType", nextEventType);

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

      if (requestId === latestRequest.current) {
        const items = normalizeActivityRows(activityBody);
        setRows(items.slice(0, LIST_PAGE_SIZE));
        setHasNext(items.length > LIST_PAGE_SIZE);
        setPage(nextPage);
        setAppliedEventType(nextEventType);
        setSummary(normalizeSummary(summaryBody));
      }
    } catch (err) {
      if (requestId === latestRequest.current) setError(err instanceof Error ? err.message : "Failed to load activity.");
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(0, true);
    return () => { latestRequest.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-danger/40 bg-danger-subtle p-4 text-sm text-danger">
          {pt(platformErrorKey(error))}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-4 md:grid-cols-5">
          <PlatformStatCard label={pt("Total Events (7d)")} value={summary.total7d} />
          <PlatformStatCard
            label={pt("School Creations")}
            value={summary.schoolCreations7d}
          />
          <PlatformStatCard label={pt("Staff Creations")} value={summary.staffCreations7d} />
          <PlatformStatCard
            label={pt("Password Resets")}
            value={summary.passwordResets7d}
          />
          <PlatformStatCard label={pt("Status Changes")} value={summary.statusChanges7d} />
        </div>
      ) : null}

      <PlatformPanel title={pt("Filters")} subtitle={pt("Narrow the feed by school or event type.")}>
        <form onSubmit={event => { event.preventDefault(); void loadData(0, true); }} className="flex flex-wrap gap-3">
          <select
            aria-label={pt("School")}
            className="rounded-xl border border-input bg-surface text-foreground px-3 py-2"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
          >
            <option value="">{pt("All schools")}</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name} ({school.code})
              </option>
            ))}
          </select>

          <input
            aria-label={pt("Event type")}
            className="rounded-xl border border-input bg-surface text-foreground px-3 py-2"
            placeholder={pt("Event type (optional)")}
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl border border-input bg-surface text-foreground px-4 py-2 hover:bg-surface-muted"
          >{pt("Apply")}{" "}</button>
        </form>
      </PlatformPanel>

      <PlatformPanel
        title={pt("Recent Platform Activity")}
        subtitle={pt("Latest school operations, lifecycle changes, support actions, and managed workspace entry.")}
      >
        {loading ? (
          <div className="rounded-xl bg-surface-muted p-4 text-muted-foreground">{pt("Loading activity...")}{" "}</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={pt("No activity found")}
            description={pt("Platform events will appear here as actions happen.")}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">
                    <PlatformAuditSummary summary={row.summary} eventType={row.event_type} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString(locale === "fr" ? "fr-HT" : "en-US")}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <PlatformBadge>{pt(row.event_type in platformFr ? row.event_type : "Recorded action")}</PlatformBadge>
                  <PlatformBadge tone="neutral">{pt(row.actor_type)}</PlatformBadge>
                  {row.school_name ? (
                    <PlatformBadge tone="blue">{row.school_name}</PlatformBadge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </PlatformPanel>
      <ListPagination page={page} start={rows.length ? page * LIST_PAGE_SIZE + 1 : 0} end={rows.length ? page * LIST_PAGE_SIZE + rows.length : 0} hasNext={hasNext} disabled={loading} onPageChange={nextPage => void loadData(nextPage)} />
    </div>
  );
}
